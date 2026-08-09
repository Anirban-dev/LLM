import { Router, Request, Response } from 'express';
import { authenticateJwt } from '../auth';
import { Persona } from '../models/Persona';
import { extractPersonaFromDirectText } from '../services/personaExtractor';

const router = Router();

// Extract persona profile from text description
router.post('/extract-text', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const { rawText, name } = req.body;
    if (!rawText || !rawText.trim()) {
      res.status(400).json({ message: 'Text description is required' });
      return;
    }

    const personaData = await extractPersonaFromDirectText(rawText, name);
    res.json(personaData);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Export persona as JSON
router.get('/export-json/:personaId', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const { personaId } = req.params;
    const persona = await Persona.findById(personaId);

    if (!persona) {
      res.status(404).json({ message: 'Persona not found' });
      return;
    }

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      persona: {
        name: persona.name,
        systemPrompt: persona.systemPrompt,
        bio: persona.bio,
        style: persona.style,
        stances: persona.stances,
        voiceSettings: persona.voiceSettings,
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${persona.name.replace(/\s+/g, '_')}_persona.json"`);
    res.json(exportData);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// Import persona from JSON
router.post('/import-json', authenticateJwt, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user._id || (req as any).user.id;
    const { jsonContent } = req.body;

    let parsed: any;
    try {
      parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    } catch (pErr) {
      res.status(400).json({ message: 'Invalid JSON content' });
      return;
    }

    const pData = parsed.persona || parsed;
    if (!pData.name) {
      res.status(400).json({ message: 'Persona JSON must specify a name' });
      return;
    }

    const newPersona = new Persona({
      userId,
      creatorId: userId,
      name: pData.name,
      systemPrompt: pData.systemPrompt || '',
      bio: pData.bio || {},
      style: pData.style || {},
      stances: pData.stances || [],
      voiceSettings: pData.voiceSettings || { voiceId: 'alloy', speed: 1.0, autoVoiceReply: false },
      isPublic: false,
    });

    await newPersona.save();
    res.status(201).json(newPersona);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
