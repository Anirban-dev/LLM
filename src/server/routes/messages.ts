import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateJwt } from '../passport';
import { Message } from '../models/Message';
import { Chat } from '../models/Chat';

const router = Router();

// Ensure uploads folder exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `voice-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.originalname.match(/\.(webm|opus|wav|mp3|m4a|ogg)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

// Upload Audio Endpoint
router.post(
  '/upload-audio',
  authenticateJwt,
  upload.single('audio'),
  (req: Request, res: Response): void => {
    try {
      if (!req.file) {
        res.status(400).json({ message: 'No audio file uploaded' });
        return;
      }

      const duration = req.body.duration ? parseFloat(req.body.duration) : 0;
      const mediaUrl = `/uploads/${req.file.filename}`;

      res.json({
        mediaUrl,
        duration,
        filename: req.file.filename,
        size: req.file.size,
      });
    } catch (error: any) {
      console.error('Audio upload error:', error);
      res.status(500).json({ message: error.message || 'Error uploading audio file' });
    }
  }
);

// Get messages for a chat
router.get('/:chatId', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const { chatId } = req.params;
    const userId = (req.user as any)._id;

    // Verify user is a participant
    const chat = await Chat.findOne({ _id: chatId, participants: userId });
    if (!chat) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const messages = await Message.find({ chatId })
      .populate('senderId', '-passwordHash')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching messages' });
  }
});

// Post a new message (text or audio)
router.post('/', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const senderId = (req.user as any)._id;
    const { chatId, type, content, mediaUrl, duration } = req.body;

    if (!chatId) {
      res.status(400).json({ message: 'chatId is required' });
      return;
    }

    const chat = await Chat.findOne({ _id: chatId, participants: senderId });
    if (!chat) {
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    const message = new Message({
      chatId,
      senderId,
      type: type || 'text',
      content: content || (type === 'audio' ? '🎤 Voice note' : ''),
      mediaUrl: mediaUrl || '',
      duration: duration || 0,
    });

    await message.save();

    // Update Chat lastMessage
    chat.lastMessage = message._id as any;
    await chat.save();

    const populatedMessage = await Message.findById(message._id).populate('senderId', '-passwordHash');

    res.status(201).json(populatedMessage);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error sending message' });
  }
});

export default router;
