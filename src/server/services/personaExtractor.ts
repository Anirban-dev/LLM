import { GoogleGenAI } from '@google/genai';
import { Persona } from '../models/Persona';
import { User } from '../models/User';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

// Fast local CPU signal extraction using Ollama (Zero cloud tokens)
async function extractLocalSignals(userText: string, currentProfileSummary?: string): Promise<string> {
  const prompt = `Extract raw key facts, hobbies, tone habits, catchphrases, and opinions from this text in short bullets.
Text: "${userText}"
${currentProfileSummary ? `Current Profile: "${currentProfileSummary}"` : ''}
Bullets:`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { num_predict: 128 }, // Keep local output tiny and fast
      }),
    });

    if (res.ok) {
      const data: any = await res.json();
      return (data.response || '').trim();
    }
  } catch (err) {
    // Local Ollama offline, fallback to raw text
  }
  return userText.slice(0, 300); // Fallback snippet
}

// Ultra-low token 1-pass Cloud Persona Generator using Gemini
async function synthesizePersonaWithCloud(
  targetName: string,
  rawSignals: string,
  existingPersona?: any
): Promise<any> {
  if (!process.env.GEMINI_API_KEY) return null;

  // Compact prompt to minimize input and output token consumption
  const prompt = `Return ONLY a minified JSON persona profile for "${targetName}".
Signals: ${rawSignals}
${existingPersona ? `Existing: ${JSON.stringify(existingPersona)}` : ''}

JSON Schema:
{"name":"${targetName}","bio":{"occupation":"","hobbies":[],"facts":[],"relationships":[]},"style":{"tone":"","punctuation":"","frequently_used_phrases":[],"emoji_usage":""},"stances":[]}`;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        maxOutputTokens: 250, // Strict token limit for ultra-low token consumption
      },
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error('Cloud persona synthesis error:', err);
  }
  return null;
}

// Asynchronously extract persona details without blocking chat UI
export async function processMessageForPersona(userId: string, userMessageContent: string): Promise<void> {
  // Ignore short messages like "hi", "ok", "cool", or non-text
  if (!userMessageContent || userMessageContent.trim().length < 5) return;

  try {
    const user = await User.findById(userId);
    if (!user) return;

    let persona = await Persona.findOne({ userId });
    if (!persona) {
      persona = new Persona({
        userId: user._id,
        name: user.username,
        bio: { occupation: '', hobbies: [], facts: [], relationships: [] },
        style: { tone: 'casual', punctuation: 'standard', frequently_used_phrases: [], emoji_usage: 'occasional' },
        stances: [],
      });
      await persona.save();
    }

    const currentSummary = `${persona.bio?.occupation || ''}; facts: ${(persona.bio?.facts || []).join(', ')}; tone: ${persona.style?.tone || ''}`;

    // STEP 1: Local Ollama CPU model extracts raw signals (Zero cloud token cost)
    console.log(`🤖 [Step 1: Local CPU] Extracting raw signals for ${user.username}...`);
    const rawSignals = await extractLocalSignals(userMessageContent, currentSummary);

    let finalJson: any = null;

    // STEP 2: Cloud Gemini model synthesizes high-quality persona in 1 pass with ultra-low token usage
    if (process.env.GEMINI_API_KEY) {
      console.log(`✨ [Step 2: Cloud Model 1-Pass] Building persona profile for ${user.username} (Ultra-low token)...`);
      finalJson = await synthesizePersonaWithCloud(persona.name, rawSignals, {
        bio: persona.bio,
        style: persona.style,
        stances: persona.stances,
      });
    }

    // Fallback if Cloud unavailable: Parse local signals basic format
    if (!finalJson && rawSignals) {
      finalJson = {
        name: persona.name,
        bio: {
          occupation: persona.bio?.occupation || '',
          hobbies: persona.bio?.hobbies || [],
          facts: Array.from(new Set([...(persona.bio?.facts || []), rawSignals.slice(0, 100)])),
          relationships: persona.bio?.relationships || [],
        },
        style: persona.style,
        stances: persona.stances,
      };
    }

    // Update DB if JSON extracted
    if (finalJson) {
      if (finalJson.bio) {
        persona.bio = {
          occupation: finalJson.bio.occupation || persona.bio.occupation,
          hobbies: Array.from(new Set([...(persona.bio.hobbies || []), ...(finalJson.bio.hobbies || [])])),
          facts: Array.from(new Set([...(persona.bio.facts || []), ...(finalJson.bio.facts || [])])),
          relationships: Array.from(new Set([...(persona.bio.relationships || []), ...(finalJson.bio.relationships || [])])),
        };
      }
      if (finalJson.style) {
        persona.style = {
          tone: finalJson.style.tone || persona.style.tone,
          punctuation: finalJson.style.punctuation || persona.style.punctuation,
          frequently_used_phrases: Array.from(
            new Set([...(persona.style.frequently_used_phrases || []), ...(finalJson.style.frequently_used_phrases || [])])
          ),
          emoji_usage: finalJson.style.emoji_usage || persona.style.emoji_usage,
        };
      }
      if (Array.isArray(finalJson.stances)) {
        persona.stances = Array.from(new Set([...(persona.stances || []), ...finalJson.stances]));
      }

      persona.updatedAt = new Date();
      await persona.save();
    }
  } catch (err) {
    console.error('Background persona extraction error:', err);
  }
}

// Convert direct plain text into a structured persona JSON using Local Extract -> Cloud 1-Pass
export async function extractPersonaFromDirectText(rawText: string, suggestedName?: string): Promise<any> {
  const targetName = suggestedName?.trim() || 'AI Persona';

  if (!rawText || !rawText.trim()) {
    return {
      name: targetName,
      bio: { occupation: 'Friend', hobbies: [], facts: [], relationships: [] },
      style: { tone: 'friendly', punctuation: 'standard', frequently_used_phrases: [], emoji_usage: 'occasional' },
      stances: [],
    };
  }

  // STEP 1: Local Ollama CPU extracts raw key signals
  console.log(`🤖 [Step 1: Local CPU] Extracting raw signals from text for ${targetName}...`);
  const rawSignals = await extractLocalSignals(rawText);

  // STEP 2: Cloud model synthesizes high quality persona in 1 pass with ultra-low token consumption
  if (process.env.GEMINI_API_KEY) {
    console.log(`✨ [Step 2: Cloud Model 1-Pass] Synthesizing persona profile for ${targetName}...`);
    const cloudResult = await synthesizePersonaWithCloud(targetName, rawSignals);
    if (cloudResult) return cloudResult;
  }

  // Fallback if cloud API key not provided
  return {
    name: targetName,
    bio: { occupation: 'Friend', hobbies: [], facts: [rawSignals || rawText.slice(0, 100)], relationships: [] },
    style: { tone: 'casual and friendly', punctuation: 'standard', frequently_used_phrases: [], emoji_usage: 'occasional' },
    stances: [],
  };
}

