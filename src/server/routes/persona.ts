import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../auth';
import { Persona } from '../models/Persona';
import { User } from '../models/User';
import { Chat } from '../models/Chat';
import { Message } from '../models/Message';
import { generateCloneResponse } from '../services/cloneAgent';
import { extractPersonaFromDirectText } from '../services/personaExtractor';

const router = Router();

// 1. Get current user's persona profile
router.get('/me', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    let persona = await Persona.findOne({ userId: user._id });

    if (!persona) {
      persona = new Persona({
        userId: user._id,
        name: user.username,
        bio: { occupation: 'User', hobbies: ['chatting'], facts: ['Active member'], relationships: [] },
        style: { tone: 'friendly and direct', punctuation: 'casual', frequently_used_phrases: ['sounds good'], emoji_usage: 'occasional' },
        stances: [],
      });
      await persona.save();
    }

    res.json(persona);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error fetching persona' });
  }
});

// 2. Update current user's persona profile manually
router.put('/me', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { bio, style, stances } = req.body;

    let persona = await Persona.findOne({ userId: user._id });
    if (!persona) {
      persona = new Persona({ userId: user._id, name: user.username });
    }

    if (bio) persona.bio = bio;
    if (style) persona.style = style;
    if (stances) persona.stances = stances;

    persona.updatedAt = new Date();
    await persona.save();

    res.json(persona);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error updating persona' });
  }
});

// 3. Export my_persona.json
router.get('/export', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    let persona = await Persona.findOne({ userId: user._id });

    if (!persona) {
      persona = new Persona({
        userId: user._id,
        name: user.username,
        bio: { occupation: 'User', hobbies: [], facts: [], relationships: [] },
        style: { tone: 'friendly', punctuation: 'standard', frequently_used_phrases: [], emoji_usage: 'occasional' },
        stances: [],
      });
      await persona.save();
    }

    const personaJson = {
      name: persona.name,
      bio: persona.bio,
      style: persona.style,
      stances: persona.stances || [],
      exportedAt: new Date().toISOString(),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="my_persona_${user.username}.json"`);
    res.send(JSON.stringify(personaJson, null, 2));
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error exporting persona' });
  }
});

// 4. Import or create a persona (via exported JSON file OR direct text) & start Clone Chat
router.post('/import', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    const { personaJson, directText, name } = req.body;

    let finalPersonaData: any = null;

    if (directText && directText.trim()) {
      // Parse plain text description into structured persona using local Ollama/Gemini
      console.log(`🧠 Parsing direct text description for clone persona: ${name || 'User'}`);
      finalPersonaData = await extractPersonaFromDirectText(directText.trim(), name?.trim() || 'AI Friend');
    } else if (personaJson) {
      finalPersonaData = typeof personaJson === 'string' ? JSON.parse(personaJson) : personaJson;
    }

    if (!finalPersonaData || !finalPersonaData.name) {
      res.status(400).json({ message: 'Valid persona JSON file or direct text description is required' });
      return;
    }

    const cloneName = name?.trim() || finalPersonaData.name;
    const cloneUsername = `${cloneName} (AI Clone)`;
    let cloneUser = await User.findOne({ username: cloneUsername });

    if (!cloneUser) {
      cloneUser = new User({
        username: cloneUsername,
        email: `clone_${Date.now()}@aiclone.local`,
        passwordHash: 'AI_CLONE_NO_PASSWORD',
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cloneUsername)}`,
        isOnline: true,
      });
      await cloneUser.save();
    }

    // Upsert Clone's Persona
    let clonePersona = await Persona.findOne({ userId: cloneUser._id });
    if (!clonePersona) {
      clonePersona = new Persona({
        userId: cloneUser._id,
        name: cloneName,
      });
    }

    clonePersona.bio = finalPersonaData.bio || clonePersona.bio;
    clonePersona.style = finalPersonaData.style || clonePersona.style;
    clonePersona.stances = finalPersonaData.stances || clonePersona.stances;
    await clonePersona.save();

    // Find or create direct chat between current user and clone user
    let chat = await Chat.findOne({
      isGroup: false,
      participants: { $all: [currentUser._id, cloneUser._id] },
    });

    if (!chat) {
      chat = new Chat({
        isGroup: false,
        participants: [currentUser._id, cloneUser._id],
      });
      await chat.save();
    }

    // Send initial greeting message from the Clone
    const greetingPrompt = "Say a quick, friendly hi to your friend!";
    const greetingText = await generateCloneResponse(
      {
        name: cloneName,
        bio: clonePersona.bio,
        style: clonePersona.style,
        stances: clonePersona.stances,
      },
      [],
      greetingPrompt
    );

    const greetingMsg = new Message({
      chatId: chat._id,
      senderId: cloneUser._id,
      content: greetingText,
      type: 'text',
    });
    await greetingMsg.save();

    chat.lastMessage = greetingMsg._id;
    await chat.save();

    res.json({
      message: 'Persona imported successfully',
      chatId: chat._id,
      cloneUser,
      persona: clonePersona,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error importing/creating persona' });
  }
});

// 5. Send message to AI Clone of target user
router.post('/clone-chat/:targetUserId', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    const { targetUserId } = req.params;
    const { content, chatId } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ message: 'Message content is required' });
      return;
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      res.status(404).json({ message: 'Target user for clone not found' });
      return;
    }

    let persona = await Persona.findOne({ userId: targetUserId });
    if (!persona) {
      persona = new Persona({
        userId: targetUser._id,
        name: targetUser.username,
        bio: { occupation: 'Friend', hobbies: [], facts: [], relationships: [] },
        style: { tone: 'friendly', punctuation: 'standard', frequently_used_phrases: [], emoji_usage: 'casual' },
        stances: [],
      });
      await persona.save();
    }

    let chat = await Chat.findById(chatId);
    if (!chat) {
      chat = await Chat.findOne({
        isGroup: false,
        participants: { $all: [currentUser._id, targetUser._id] },
      });
    }

    if (!chat) {
      chat = new Chat({
        isGroup: false,
        participants: [currentUser._id, targetUser._id],
      });
      await chat.save();
    }

    // 1. Save user's message
    const userMsg = new Message({
      chatId: chat._id,
      senderId: currentUser._id,
      content: content.trim(),
      type: 'text',
    });
    await userMsg.save();

    // 2. Fetch past conversation history
    const recentMsgs = await Message.find({ chatId: chat._id })
      .sort({ createdAt: -1 })
      .limit(10);

    const conversationHistory = recentMsgs.reverse().map((m) => ({
      role: m.senderId.toString() === currentUser._id.toString() ? ('user' as const) : ('assistant' as const),
      content: m.content || '',
    }));

    // 3. Generate Clone response via CPU Ollama / Gemini fallback
    const cloneReplyText = await generateCloneResponse(
      {
        name: targetUser.username,
        bio: persona.bio,
        style: persona.style,
        stances: persona.stances,
      },
      conversationHistory,
      content.trim()
    );

    // 4. Save Clone message
    const cloneMsg = new Message({
      chatId: chat._id,
      senderId: targetUser._id,
      content: cloneReplyText,
      type: 'text',
    });
    await cloneMsg.save();

    chat.lastMessage = cloneMsg._id;
    await chat.save();

    res.json({
      userMessage: userMsg,
      cloneMessage: cloneMsg,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error generating AI Clone response' });
  }
});

// 6. GET /api/personas - List public personas + user's created personas
router.get('/', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const personas = await Persona.find({
      $or: [{ isPublic: true }, { creatorId: user._id }, { userId: user._id }],
    }).sort({ createdAt: -1 });

    res.json(personas);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error listing personas' });
  }
});

// 7. GET /api/personas/:id - Get specific persona
router.get('/:id', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const persona = await Persona.findById(req.params.id);
    if (!persona) {
      res.status(404).json({ message: 'Persona not found' });
      return;
    }
    res.json(persona);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error getting persona' });
  }
});

// 8. POST /api/personas - Create new AI Persona
router.post('/', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const {
      name,
      tagline,
      avatarUrl,
      category,
      systemPrompt,
      greetingMessage,
      model,
      temperature,
      maxTokens,
      voiceSettings,
      isPublic,
    } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Persona name is required' });
      return;
    }

    const persona = new Persona({
      creatorId: user._id,
      name: name.trim(),
      tagline: tagline || 'AI Conversation Partner',
      avatarUrl:
        avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name.trim())}`,
      category: category || 'Assistant',
      systemPrompt: systemPrompt || 'You are a helpful and friendly AI persona.',
      greetingMessage: greetingMessage || 'Hello! How can I help you today?',
      model: model || 'gpt-4o',
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 1000,
      voiceSettings: voiceSettings || { voiceId: 'alloy', speed: 1.0, autoVoiceReply: false },
      isPublic: isPublic !== false,
    });

    await persona.save();

    // Create shadow user for persona if not exists for direct messaging compatibility
    const botUsername = `${persona.name} (AI)`;
    let shadowUser = await User.findOne({ username: botUsername });
    if (!shadowUser) {
      shadowUser = new User({
        username: botUsername,
        email: `bot_${persona._id}@chatapp.local`,
        passwordHash: 'AI_BOT_NO_PASSWORD',
        avatarUrl: persona.avatarUrl,
        isOnline: true,
      });
      await shadowUser.save();
    }

    res.status(201).json(persona);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error creating persona' });
  }
});

// 9. PUT /api/personas/:id - Update AI Persona
router.put('/:id', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const persona = await Persona.findById(req.params.id);

    if (!persona) {
      res.status(404).json({ message: 'Persona not found' });
      return;
    }

    const {
      name,
      tagline,
      avatarUrl,
      category,
      systemPrompt,
      greetingMessage,
      model,
      temperature,
      maxTokens,
      voiceSettings,
      isPublic,
    } = req.body;

    if (name) persona.name = name.trim();
    if (tagline !== undefined) persona.tagline = tagline;
    if (avatarUrl !== undefined) persona.avatarUrl = avatarUrl;
    if (category !== undefined) persona.category = category;
    if (systemPrompt !== undefined) persona.systemPrompt = systemPrompt;
    if (greetingMessage !== undefined) persona.greetingMessage = greetingMessage;
    if (model !== undefined) persona.model = model;
    if (temperature !== undefined) persona.temperature = temperature;
    if (maxTokens !== undefined) persona.maxTokens = maxTokens;
    if (voiceSettings !== undefined) persona.voiceSettings = voiceSettings;
    if (isPublic !== undefined) persona.isPublic = isPublic;

    persona.updatedAt = new Date();
    await persona.save();

    res.json(persona);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error updating persona' });
  }
});

// 10. DELETE /api/personas/:id - Delete AI Persona
router.delete('/:id', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    await Persona.findByIdAndDelete(req.params.id);
    res.json({ message: 'Persona deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error deleting persona' });
  }
});

// 11. POST /api/personas/:id/chat - Start or open 1-on-1 chat room with this AI Persona
router.post('/:id/chat', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    const persona = await Persona.findById(req.params.id);

    if (!persona) {
      res.status(404).json({ message: 'Persona not found' });
      return;
    }

    // Ensure shadow user exists
    const botUsername = `${persona.name} (AI)`;
    let shadowUser = await User.findOne({ username: botUsername });
    if (!shadowUser) {
      shadowUser = new User({
        username: botUsername,
        email: `bot_${persona._id}@chatapp.local`,
        passwordHash: 'AI_BOT_NO_PASSWORD',
        avatarUrl: persona.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(persona.name)}`,
        isOnline: true,
      });
      await shadowUser.save();
    }

    let chat = await Chat.findOne({
      isGroup: false,
      participants: { $all: [currentUser._id, shadowUser._id] },
    });

    if (!chat) {
      chat = new Chat({
        isGroup: false,
        participants: [currentUser._id, shadowUser._id],
        personaParticipants: [persona._id],
      });
      await chat.save();

      // Send greeting message from Persona
      const greetingMsg = new Message({
        chatId: chat._id,
        senderId: shadowUser._id,
        senderType: 'Persona',
        senderPersona: persona._id,
        content: persona.greetingMessage || `Hello! I am ${persona.name}. How can I help you today?`,
        type: 'text',
      });
      await greetingMsg.save();

      chat.lastMessage = greetingMsg._id;
      await chat.save();
    }

    res.json({ chatId: chat._id, persona, shadowUser });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Error opening chat with persona' });
  }
});

export default router;

