import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../auth';
import { Persona } from '../models/Persona';
import { User } from '../models/User';
import { Chat } from '../models/Chat';

const router = Router();

// Get current user's persona
router.get('/me', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id || (req as any).user.id;
    let persona = await Persona.findOne({ userId });

    if (!persona) {
      const user = await User.findById(userId);
      persona = new Persona({
        userId,
        name: user?.username || 'My AI Persona',
        bio: { occupation: 'User', hobbies: [], facts: [], relationships: [] },
        style: { tone: 'friendly', punctuation: 'standard', frequently_used_phrases: [], emoji_usage: 'occasional' },
      });
      await persona.save();
    }

    res.json(persona);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Update user's persona
router.post('/me', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id || (req as any).user.id;
    const { name, systemPrompt, model, temperature, maxTokens, bio, style, voiceSettings } = req.body;

    let persona = await Persona.findOne({ userId });

    if (!persona) {
      persona = new Persona({ userId, name: name || 'AI Persona' });
    }

    if (name) persona.name = name;
    if (systemPrompt !== undefined) persona.systemPrompt = systemPrompt;
    if (model) persona.model = model;
    if (temperature !== undefined) persona.temperature = temperature;
    if (maxTokens !== undefined) persona.maxTokens = maxTokens;
    if (bio) persona.bio = bio;
    if (style) persona.style = style;
    if (voiceSettings) persona.voiceSettings = voiceSettings;

    persona.updatedAt = new Date();
    await persona.save();

    res.json(persona);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Get public community personas
router.get('/community', authenticateJwt, async (_req: Request, res: Response): Promise<void> => {
  try {
    const personas = await Persona.find({ isPublic: true }).limit(30);
    res.json(personas);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Create 1-on-1 AI Chat with a Persona
router.post('/chat-room', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id || (req as any).user.id;
    const { personaId } = req.body;

    const persona = await Persona.findById(personaId);
    if (!persona) {
      res.status(404).json({ message: 'Persona not found' });
      return;
    }

    const shadowUsername = `${persona.name} (AI)`;
    let shadowUser = await User.findOne({ username: shadowUsername });

    if (!shadowUser) {
      shadowUser = new User({
        username: shadowUsername,
        email: `persona_${persona._id}@ai.app`,
        avatarUrl: persona.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(persona.name)}`,
        isOnline: true,
      });
      await shadowUser.save();
    }

    let chat = await Chat.findOne({
      isGroup: false,
      participants: { $all: [userId, shadowUser._id], $size: 2 },
    }).populate('participants', '-passwordHash');

    if (!chat) {
      chat = new Chat({
        isGroup: false,
        participants: [userId, shadowUser._id],
        personaParticipants: [persona._id],
      });
      await chat.save();
      chat = await Chat.findById(chat._id).populate('participants', '-passwordHash');
    }

    res.status(201).json(chat);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
