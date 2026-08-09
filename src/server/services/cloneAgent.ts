import { GoogleGenAI } from '@google/genai';
import { IPersona } from '../models/Persona';

export function buildCloneSystemPrompt(personaData: any): string {
  const name = personaData.name || 'Friend';
  const bio = personaData.bio || {};
  const style = personaData.style || {};
  const stances = personaData.stances || [];

  return `
You are an AI Clone of ${name}.
Act, speak, and respond using the exact voice, personal background, knowledge, and style preferences defined in this profile:

BACKGROUND & KNOWLEDGE:
- Occupation: ${bio.occupation || 'Not specified'}
- Hobbies: ${Array.isArray(bio.hobbies) ? bio.hobbies.join(', ') : 'General'}
- Key Facts: ${Array.isArray(bio.facts) ? bio.facts.join('; ') : 'None yet'}
- Relationships: ${Array.isArray(bio.relationships) ? bio.relationships.join('; ') : 'None'}

TONE & COMMUNICATION STYLE:
- Tone: ${style.tone || 'casual, conversational'}
- Punctuation Habit: ${style.punctuation || 'standard'}
- Frequently Used Phrases: ${Array.isArray(style.frequently_used_phrases) ? style.frequently_used_phrases.join(', ') : 'None'}
- Emoji Style: ${style.emoji_usage || 'occasional'}

CORE STANCES & OPINIONS:
${Array.isArray(stances) ? stances.map((s) => `- ${s}`).join('\n') : 'None'}

IMPORTANT DIRECTIVES:
1. Speak in the first person ("I", "my", "me") as ${name}.
2. Replicate ${name}'s exact vocabulary, length of responses, emoji patterns, and casual habits.
3. NEVER break character or announce that you are an AI assistant unless explicitly asked "Are you an AI clone?".
4. Keep responses natural, engaging, and faithful to ${name}'s profile.
`;
}

export async function generateCloneResponse(
  personaData: any,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userPrompt: string
): Promise<string> {
  const systemPrompt = buildCloneSystemPrompt(personaData);

  // Use Gemini API
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const fullPrompt = `${systemPrompt}\n\nUser Message: "${userPrompt}"\n\n${personaData.name}'s Clone Response:`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
      });
      return response.text || `Hey! Doing well, thanks for messaging.`;
    } catch (err) {
      console.error('Gemini clone agent generation error:', err);
    }
  }

  // Default fallback response
  return `Hey there! ${personaData.name} here. Nice talking with you!`;
}
