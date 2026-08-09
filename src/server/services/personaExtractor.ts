import { GoogleGenAI } from '@google/genai';
import { Persona } from '../models/Persona';
import { User } from '../models/User';

/**
 * Lightweight local pattern extraction (Zero external API / Zero token cost)
 * Extracts key traits, hobbies, or phrases using local regex sentence parsing.
 */
function extractLocalTraits(text: string): string {
  if (!text) return '';

  const clean = text.trim();
  const sentences = clean.split(/[.!?\n]+/).map((s) => s.trim()).filter((s) => s.length > 5);

  const keySentenceMatches: string[] = [];

  for (const sentence of sentences) {
    if (
      /\b(i am|i work|i love|i hate|my hobby|i like|always|never|favorite|im)\b/i.test(sentence)
    ) {
      keySentenceMatches.push(sentence.slice(0, 80));
    }
  }

  // Fallback to first sentence if no key patterns matched
  if (keySentenceMatches.length === 0 && sentences.length > 0) {
    keySentenceMatches.push(sentences[0].slice(0, 100));
  }

  return keySentenceMatches.slice(0, 3).join('; ');
}

/**
 * Compact Cloud Persona Synthesizer using Gemini (Low Token Consumption)
 */
async function synthesizePersonaWithCloud(
  targetName: string,
  compressedSignals: string
): Promise<any> {
  if (!process.env.GEMINI_API_KEY || !compressedSignals) return null;

  const prompt = `Synthesize concise JSON persona profile for "${targetName}".
Traits: "${compressedSignals}"
JSON Schema:
{"name":"${targetName}","bio":{"occupation":"","hobbies":[],"facts":[]},"style":{"tone":"friendly","punctuation":"standard","frequently_used_phrases":[],"emoji_usage":"occasional"}}`;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        maxOutputTokens: 150, // Strict output token limit to prevent quota exhaustion
      },
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.warn('Cloud persona synthesis skipped or rate-limited:', err);
  }

  return null;
}

/**
 * Process incoming user message to update AI Persona profile asynchronously.
 */
export async function processMessageForPersona(userId: string, userMessageContent: string): Promise<void> {
  if (!userMessageContent || userMessageContent.trim().length < 8) return;

  try {
    const user = await User.findById(userId);
    if (!user) return;

    let persona = await Persona.findOne({ userId });
    if (!persona) {
      persona = new Persona({
        userId: user._id,
        name: user.username,
        bio: { occupation: 'Friend', hobbies: [], facts: [], relationships: [] },
        style: { tone: 'casual', punctuation: 'standard', frequently_used_phrases: [], emoji_usage: 'occasional' },
        stances: [],
      });
      await persona.save();
    }

    // Step 1: Compress traits locally without LLM calls
    const compressedSignals = extractLocalTraits(userMessageContent);
    if (!compressedSignals) return;

    // Step 2: Update local facts
    const updatedFacts = Array.from(
      new Set([...(persona.bio?.facts || []), compressedSignals.slice(0, 80)])
    ).slice(0, 10); // Cap at 10 facts max

    persona.bio = {
      ...persona.bio,
      facts: updatedFacts,
    };

    // Step 3: Optional lightweight Cloud Gemini pass for tone refinement
    if (process.env.GEMINI_API_KEY) {
      const cloudJson = await synthesizePersonaWithCloud(persona.name, compressedSignals);
      if (cloudJson?.style) {
        persona.style = {
          tone: cloudJson.style.tone || persona.style?.tone || 'friendly',
          punctuation: cloudJson.style.punctuation || persona.style?.punctuation || 'standard',
          frequently_used_phrases: Array.from(
            new Set([...(persona.style?.frequently_used_phrases || []), ...(cloudJson.style.frequently_used_phrases || [])])
          ).slice(0, 5),
          emoji_usage: cloudJson.style.emoji_usage || persona.style?.emoji_usage || 'occasional',
        };
      }
    }

    persona.updatedAt = new Date();
    await persona.save();
  } catch (err) {
    console.error('Persona processing error:', err);
  }
}

/**
 * Convert direct plain text or description into a structured AI Persona JSON.
 */
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

  const compressedSignals = extractLocalTraits(rawText) || rawText.slice(0, 150);

  if (process.env.GEMINI_API_KEY) {
    const cloudProfile = await synthesizePersonaWithCloud(targetName, compressedSignals);
    if (cloudProfile) return cloudProfile;
  }

  // Fallback structured persona
  return {
    name: targetName,
    bio: { occupation: 'Friend', hobbies: [], facts: [compressedSignals], relationships: [] },
    style: { tone: 'casual and friendly', punctuation: 'standard', frequently_used_phrases: [], emoji_usage: 'occasional' },
    stances: [],
  };
}
