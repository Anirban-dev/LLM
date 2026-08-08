import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyToken } from './passport';
import { User } from './models/User';
import { Chat } from './models/Chat';
import { Message } from './models/Message';

interface SocketUser {
  id: string;
  email: string;
  username: string;
}

// Map to track active sockets per user ID
const userSocketsMap = new Map<string, Set<string>>();

export function initializeSocketIO(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Socket.io JWT Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = verifyToken(token) as SocketUser;
      if (!decoded || !decoded.id) {
        return next(new Error('Authentication error: Invalid token'));
      }

      socket.data.user = decoded;
      next();
    } catch (err) {
      console.error('Socket auth error:', err);
      next(new Error('Authentication error: Unauthorized'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    const userId = user.id;

    console.log(`⚡ Socket connected: User ${user.username} (${userId}), Socket ID: ${socket.id}`);

    // Track active user sockets
    if (!userSocketsMap.has(userId)) {
      userSocketsMap.set(userId, new Set());
    }
    userSocketsMap.get(userId)!.add(socket.id);

    // Update online status in DB
    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      io.emit('user_status_change', {
        userId,
        isOnline: true,
        lastSeen: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error updating online status:', error);
    }

    // Event: join_chat
    socket.on('join_chat', (chatId: string) => {
      if (!chatId) return;
      socket.join(`chat:${chatId}`);
      console.log(`User ${user.username} joined room chat:${chatId}`);
    });

    // Event: leave_chat
    socket.on('leave_chat', (chatId: string) => {
      if (!chatId) return;
      socket.leave(`chat:${chatId}`);
      console.log(`User ${user.username} left room chat:${chatId}`);
    });

    // Event: send_message
    socket.on(
      'send_message',
      async (
        data: {
          chatId: string;
          type: 'text' | 'audio';
          content?: string;
          mediaUrl?: string;
          duration?: number;
        },
        callback?: (res: any) => void
      ) => {
        try {
          const { chatId, type, content, mediaUrl, duration } = data;

          if (!chatId) {
            if (callback) callback({ status: 'error', message: 'Chat ID required' });
            return;
          }

          // Verify user is in the chat
          const chat = await Chat.findOne({ _id: chatId, participants: userId });
          if (!chat) {
            if (callback) callback({ status: 'error', message: 'Chat not found' });
            return;
          }

          // Create message
          const message = new Message({
            chatId,
            senderId: userId,
            type: type || 'text',
            content: content || (type === 'audio' ? '🎤 Voice note' : ''),
            mediaUrl: mediaUrl || '',
            duration: duration || 0,
          });

          await message.save();

          // Update Chat lastMessage and updatedAt
          chat.lastMessage = message._id as any;
          chat.updatedAt = new Date();
          await chat.save();

          const populatedMessage = await Message.findById(message._id).populate(
            'senderId',
            '-passwordHash'
          );

          // Broadcast message to room chat:<chatId>
          io.to(`chat:${chatId}`).emit('receive_message', populatedMessage);

          // Emit chat update to all chat participants so their chat list auto-refreshes
          const updatedChat = await Chat.findById(chatId)
            .populate('participants', '-passwordHash')
            .populate({
              path: 'lastMessage',
              populate: { path: 'senderId', select: '-passwordHash' },
            });

          chat.participants.forEach((pId) => {
            const pIdStr = pId.toString();
            const socketSet = userSocketsMap.get(pIdStr);
            if (socketSet) {
              socketSet.forEach((sId) => {
                io.to(sId).emit('chat_updated', updatedChat);
              });
            }
          });

          if (callback) callback({ status: 'ok', data: populatedMessage });
        } catch (error: any) {
          console.error('Socket send_message error:', error);
          if (callback) callback({ status: 'error', message: error.message });
        }
      }
    );

    // Event: typing_start
    socket.on('typing_start', (chatId: string) => {
      if (!chatId) return;
      socket.to(`chat:${chatId}`).emit('user_typing_start', {
        chatId,
        userId,
        username: user.username,
      });
    });

    // Event: typing_stop
    socket.on('typing_stop', (chatId: string) => {
      if (!chatId) return;
      socket.to(`chat:${chatId}`).emit('user_typing_stop', {
        chatId,
        userId,
      });
    });

    // Event: disconnect
    socket.on('disconnect', async () => {
      console.log(`🔌 Socket disconnected: User ${user.username} (${userId})`);

      const userSockets = userSocketsMap.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          userSocketsMap.delete(userId);

          // User is fully offline
          const now = new Date();
          try {
            await User.findByIdAndUpdate(userId, {
              isOnline: false,
              lastSeen: now,
            });

            io.emit('user_status_change', {
              userId,
              isOnline: false,
              lastSeen: now.toISOString(),
            });
          } catch (err) {
            console.error('Error setting offline status:', err);
          }
        }
      }
    });
  });

  return io;
}
