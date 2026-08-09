import { Server as SocketIOServer, Socket } from 'socket.io';
import { Chat } from '../models/Chat';
import { Message } from '../models/Message';
import { Persona } from '../models/Persona';
import { streamPersonaCompletion } from '../services/aiService';
import { SocketUser, UserSocketsMap } from './types';

export function registerMessageHandler(
  io: SocketIOServer,
  socket: Socket,
  userSocketsMap: UserSocketsMap
): void {
  socket.on(
    'send_message',
    async (
      data: {
        chatId: string;
        type: 'text' | 'audio' | 'image' | 'video' | 'document';
        content?: string;
        mediaUrl?: string;
        fileName?: string;
        fileSize?: number;
        duration?: number;
      },
      callback?: (res: any) => void
    ) => {
      try {
        const user = socket.data.user as SocketUser;
        const userId = user.id;
        const { chatId, type, content, mediaUrl, fileName, fileSize, duration } = data;

        if (!chatId) {
          if (callback) callback({ status: 'error', message: 'Chat ID required' });
          return;
        }

        const chat = await Chat.findOne({ _id: chatId, participants: userId }).populate('participants');
        if (!chat) {
          if (callback) callback({ status: 'error', message: 'Chat not found' });
          return;
        }

        const message = new Message({
          chatId,
          senderId: userId,
          senderType: 'User',
          type: type || 'text',
          content: content || (type === 'audio' ? '🎤 Voice note' : ''),
          mediaUrl: mediaUrl || '',
          fileName: fileName || '',
          fileSize: fileSize || 0,
          duration: duration || 0,
        });

        await message.save();

        chat.lastMessage = message._id as any;
        chat.updatedAt = new Date();
        await chat.save();

        const populatedMessage = await Message.findById(message._id).populate('senderId', '-passwordHash');

        io.to(`chat:${chatId}`).emit('receive_message', populatedMessage);

        // Notify all participant sockets of chat update
        const updatedChat = await Chat.findById(chatId)
          .populate('participants', '-passwordHash')
          .populate({ path: 'lastMessage', populate: { path: 'senderId', select: '-passwordHash' } });

        chat.participants.forEach((pId: any) => {
          const pIdStr = pId._id ? pId._id.toString() : pId.toString();
          const socketSet = userSocketsMap.get(pIdStr);
          if (socketSet) {
            socketSet.forEach((sId) => io.to(sId).emit('chat_updated', updatedChat));
          }
        });

        if (callback) callback({ status: 'ok', data: populatedMessage });

        // AI Persona Trigger Check
        const otherParticipants = (chat.participants as any[]).filter(
          (p) => p._id.toString() !== userId.toString()
        );

        let targetPersona = null;
        let shadowBotUser = null;

        for (const partner of otherParticipants) {
          if (partner.username && partner.username.includes('(AI)')) {
            const personaName = partner.username.replace(' (AI)', '').replace(' (AI Clone)', '').trim();
            targetPersona = await Persona.findOne({
              $or: [{ name: personaName }, { userId: partner._id }],
            });
            shadowBotUser = partner;
            break;
          }
        }

        if (chat.personaParticipants && chat.personaParticipants.length > 0 && !targetPersona) {
          targetPersona = await Persona.findById(chat.personaParticipants[0]);
        }

        if (targetPersona) {
          // Fetch last 10 messages strictly for context window
          const recentMsgs = await Message.find({ chatId }).sort({ createdAt: -1 }).limit(10);

          const conversationHistory = recentMsgs.reverse().map((m) => {
            const isUser = m.senderId.toString() === userId.toString();
            let formattedContent = m.content || '';

            if (m.type === 'image') {
              formattedContent = `[Image Attachment: ${m.fileName || 'Image'} (${m.mediaUrl})] ${formattedContent}`.trim();
            } else if (m.type === 'document') {
              const sizeKb = m.fileSize ? ` ${Math.round(m.fileSize / 1024)}KB` : '';
              formattedContent = `[Document Attachment: ${m.fileName || 'File'}${sizeKb}] ${formattedContent}`.trim();
            } else if (m.type === 'video') {
              formattedContent = `[Video Attachment: ${m.fileName || 'Video'}] ${formattedContent}`.trim();
            } else if (m.type === 'audio') {
              formattedContent = `[Voice Note: ${m.duration ? m.duration + 's' : 'Audio'}] ${formattedContent}`.trim();
            }

            return {
              role: isUser ? ('user' as const) : ('assistant' as const),
              content: formattedContent,
            };
          });

          io.to(`chat:${chatId}`).emit('ai_stream_start', {
            chatId,
            personaName: targetPersona.name,
            personaAvatar: targetPersona.avatarUrl,
          });

          let accumulativeText = '';

          await streamPersonaCompletion({
            persona: {
              name: targetPersona.name,
              systemPrompt: targetPersona.systemPrompt,
              model: targetPersona.model,
              temperature: targetPersona.temperature,
              maxTokens: targetPersona.maxTokens,
              voiceSettings: targetPersona.voiceSettings,
            },
            messages: conversationHistory,
            isAudioPrompt: type === 'audio',
            onChunk: (chunk: string) => {
              accumulativeText += chunk;
              io.to(`chat:${chatId}`).emit('ai_stream_chunk', { chatId, chunk, text: accumulativeText });
            },
            onDone: async (fullText: string, audioUrl?: string) => {
              try {
                const botSenderId = shadowBotUser ? shadowBotUser._id : targetPersona!.creatorId || userId;

                const aiMessage = new Message({
                  chatId,
                  senderId: botSenderId,
                  senderType: 'Persona',
                  senderPersona: targetPersona!._id,
                  type: audioUrl ? 'audio' : 'text',
                  content: fullText,
                  mediaUrl: audioUrl || '',
                  duration: audioUrl ? Math.round(fullText.length * 0.08) : 0,
                });

                await aiMessage.save();
                chat.lastMessage = aiMessage._id as any;
                chat.updatedAt = new Date();
                await chat.save();

                const populatedAiMsg = await Message.findById(aiMessage._id).populate('senderId', '-passwordHash');
                io.to(`chat:${chatId}`).emit('ai_stream_end', { chatId, message: populatedAiMsg });
                io.to(`chat:${chatId}`).emit('receive_message', populatedAiMsg);
              } catch (saveErr) {
                console.error('Error saving AI message:', saveErr);
              }
            },
            onError: (err: any) => {
              io.to(`chat:${chatId}`).emit('ai_stream_error', { chatId, error: err.message || 'Stream error' });
            },
          });
        }
      } catch (error: any) {
        console.error('send_message error:', error);
        if (callback) callback({ status: 'error', message: error.message });
      }
    }
  );
}
