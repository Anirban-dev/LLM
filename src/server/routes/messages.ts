import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { authenticateJwt } from '../auth';
import { Message } from '../models/Message';
import { Chat } from '../models/Chat';
import { processMessageForPersona } from '../services/personaExtractor';
import { uploadFileToStorage } from '../services/storage';

const router = Router();

// Lazy initialize GoogleGenAI client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// Multer in-memory storage (10MB limit)
const memoryStorage = multer.memoryStorage();
const mediaUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB strict limit
});

// Upload General Media Endpoint (/api/messages/upload-media)
router.post(
  '/upload-media',
  authenticateJwt,
  mediaUpload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ message: 'No file uploaded' });
        return;
      }

      const { fileUrl, storageType } = await uploadFileToStorage(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      const originalName = req.file.originalname;
      const size = req.file.size;
      const mimeType = req.file.mimetype;

      let fileType: 'image' | 'video' | 'document' | 'audio' = 'document';
      if (mimeType.startsWith('image/')) fileType = 'image';
      else if (mimeType.startsWith('video/')) fileType = 'video';
      else if (mimeType.startsWith('audio/')) fileType = 'audio';

      res.json({
        mediaUrl: fileUrl,
        type: fileType,
        fileName: originalName,
        fileSize: size,
        mimeType,
        storageType,
      });
    } catch (error: any) {
      console.error('Media upload error:', error);
      res.status(500).json({ message: error.message || 'Error uploading file' });
    }
  }
);


// Upload Audio Endpoint with Server-Side STT (Speech-To-Text)
router.post(
  '/upload-audio',
  authenticateJwt,
  mediaUpload.single('audio'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ message: 'No audio file uploaded' });
        return;
      }

      const duration = req.body.duration ? parseFloat(req.body.duration) : 0;
      const { fileUrl, storageType } = await uploadFileToStorage(
        req.file.buffer,
        req.file.originalname || 'voice_recording.webm',
        req.file.mimetype || 'audio/webm'
      );

      let transcript = '';

      // Server-Side STT Processing via Gemini 2.5 Flash
      const ai = getAIClient();
      if (ai) {
        try {
          const base64Audio = req.file.buffer.toString('base64');
          const mimeType = req.file.mimetype || 'audio/webm';

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                inlineData: {
                  mimeType,
                  data: base64Audio,
                },
              },
              {
                text: 'Transcribe this voice recording accurately into clear text. Respond ONLY with the raw transcript without any commentary or quotes.',
              },
            ],
          });

          transcript = response.text?.trim() || '';
          console.log(`🎙️ Audio STT Transcribed (${transcript.length} chars): "${transcript}"`);
        } catch (sttErr) {
          console.error('❌ STT Transcription failed:', sttErr);
        }
      }

      res.json({
        mediaUrl: fileUrl,
        transcript,
        duration,
        storageType,
      });
    } catch (error: any) {
      console.error('Audio upload error:', error);
      res.status(500).json({ message: error.message || 'Error uploading audio' });
    }
  }
);


// Fetch Paginated Chat Messages
router.get('/:chatId', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const messages = await Message.find({ chatId })
      .populate('senderId', 'username avatar customStatus online')
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json(messages.reverse());
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Send a Message & Handle AI Persona Triggers
router.post('/send', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
    const { chatId, content, type = 'text', mediaUrl, audioData } = req.body;

    if (!chatId) {
      res.status(400).json({ message: 'chatId is required' });
      return;
    }

    const newMessage = await Message.create({
      chatId,
      senderId: userId,
      content: content || '',
      type,
      mediaUrl,
      audioData,
    });

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: content || (type === 'audio' ? '🎤 Voice Note' : '📎 Attachment'),
      lastMessageTime: new Date(),
    });

    const populatedMsg = await Message.findById(newMessage._id).populate(
      'senderId',
      'username avatar customStatus online'
    );

    // Process AI Persona reply asynchronously if applicable
    processMessageForPersona(chatId, userId, content || '', type, mediaUrl).catch((err) =>
      console.error('AI Persona Trigger Error:', err)
    );

    res.status(201).json(populatedMsg);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
