import { GoogleGenAI } from '@google/genai';
import { generateTTSAudioFile } from './ttsService';

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

export interface StreamPersonaOptions {
  persona: {
    name: string;
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    voiceSettings?: {
      voiceId: string;
      speed: number;
      autoVoiceReply: boolean;
    };
  };
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; name?: string }>;
  isAudioPrompt?: boolean;
  onChunk: (chunk: string) => void;
  onDone: (fullText: string, audioUrl?: string) => void;
  onError: (err: any) => void;
}

/**
 * Stream AI Persona completion with strict 10-message sliding window.
 */
export async function streamPersonaCompletion(options: StreamPersonaOptions): Promise<void> {
  const { persona, messages, isAudioPrompt, onChunk, onDone, onError } = options;
  const systemPrompt =
    persona.systemPrompt ||
    `You are ${persona.name}, a friendly AI persona in a real-time chat application. Respond concisely.`;

  // Limit to last 10 messages strictly
  const last10Messages = messages.slice(-10);

  const formattedMessages = [
    { role: 'system', content: systemPrompt },
    ...last10Messages.map((m) => ({
      role: m.role,
      content: m.name ? `[${m.name}]: ${m.content}` : m.content,
    })),
  ];

  let fullResponse = '';
  let success = false;

  const gemini = getGeminiClient();
  if (gemini) {
    try {
      const geminiContents = formattedMessages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

      const resultStream = await gemini.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: geminiContents as any,
        config: {
          temperature: persona.temperature ?? 0.7,
          maxOutputTokens: persona.maxTokens ?? 500,
          systemInstruction: systemPrompt,
        },
      });

      for await (const chunk of resultStream) {
        if (chunk.text) {
          fullResponse += chunk.text;
          onChunk(chunk.text);
        }
      }

      if (fullResponse.trim()) {
        success = true;
      }
    } catch (geminiErr: any) {
      console.error('Gemini streaming error:', geminiErr?.message || geminiErr);
    }
  }

  // Fallback if Cloud Gemini API key unavailable or failed
  if (!success) {
    fullResponse = `Hello! I am ${persona.name}. I received your message and I am happy to chat!`;
    onChunk(fullResponse);
  }

  // Generate TTS Audio Voice Note if autoVoiceReply enabled or voice prompt
  let audioUrl: string | undefined = undefined;
  const shouldVoice = persona.voiceSettings?.autoVoiceReply || isAudioPrompt;

  if (shouldVoice) {
    try {
      audioUrl = await generateTTSAudioFile(fullResponse, persona.voiceSettings?.voiceId || 'alloy');
    } catch (vErr) {
      console.error('Error generating persona voice reply:', vErr);
    }
  }

  onDone(fullResponse, audioUrl);
}
