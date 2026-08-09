import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../auth';
import { Chat } from '../models/Chat';

const router = Router();

// Get all chats for logged in user
router.get('/', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?._id || (req as any).user?.userId;

    const chats = await Chat.find({ participants: userId })
      .populate('participants', '-passwordHash')
      .populate({
        path: 'lastMessage',
        populate: { path: 'senderId', select: '-passwordHash' },
      })
      .sort({ updatedAt: -1 });

    res.json(chats);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching chats' });
  }
});

// Create 1-on-1 or group chat
router.post('/', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUserId = (req as any).user?._id || (req as any).user?.userId;
    const { recipientId, isGroup, name, participantIds } = req.body;

    if (isGroup) {
      if (!name || !participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
        res.status(400).json({ message: 'Group name and participants are required' });
        return;
      }

      const allParticipants = Array.from(new Set([currentUserId.toString(), ...participantIds]));

      const newGroup = new Chat({
        isGroup: true,
        name,
        participants: allParticipants,
      });

      await newGroup.save();
      const populatedGroup = await Chat.findById(newGroup._id).populate('participants', '-passwordHash');

      res.status(201).json(populatedGroup);
      return;
    }

    // Direct 1-on-1 chat
    if (!recipientId) {
      res.status(400).json({ message: 'Recipient ID is required for direct chat' });
      return;
    }

    // Check if chat already exists
    const existingChat = await Chat.findOne({
      isGroup: false,
      participants: { $all: [currentUserId, recipientId], $size: 2 },
    })
      .populate('participants', '-passwordHash')
      .populate({
        path: 'lastMessage',
        populate: { path: 'senderId', select: '-passwordHash' },
      });

    if (existingChat) {
      res.json(existingChat);
      return;
    }

    // Create new direct chat
    const newChat = new Chat({
      isGroup: false,
      participants: [currentUserId, recipientId],
    });

    await newChat.save();
    const populatedChat = await Chat.findById(newChat._id).populate('participants', '-passwordHash');

    res.status(201).json(populatedChat);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error creating chat' });
  }
});

// Get specific chat details
router.get('/:chatId', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const { chatId } = req.params;
    const userId = (req as any).user?._id || (req as any).user?.userId;

    const chat = await Chat.findOne({ _id: chatId, participants: userId })
      .populate('participants', '-passwordHash')
      .populate({
        path: 'lastMessage',
        populate: { path: 'senderId', select: '-passwordHash' },
      });

    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }

    res.json(chat);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Error fetching chat' });
  }
});

export default router;
