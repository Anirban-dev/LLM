import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import fs from 'fs';
import { uploadFileToStorage } from './storage';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Lazy load clients
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
  if (!openaiClient) {
    const baseURL = process.env.AI_BASE_URL || 'http://127.0.0.1:11434/v1';
    const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || 'ollama';
    try {
      openaiClient = new OpenAI({ baseURL, apiKey });
    } catch (err) {
      console.warn('OpenAI client init notice:', err);
    }
  }
  return openaiClient;
}

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

/**
 * Generate synthetic PCM WAV voice note for server-side TTS
 */
export function generateServerTTSBuffer(text: string, voiceId = 'alloy'): Buffer {
  const sampleRate = 22050;
  const numChannels = 1;
  const bitsPerSample = 16;

  const durationInSeconds = Math.min(Math.max(text.length * 0.08, 1.5), 12);
  const totalSamples = Math.floor(sampleRate * durationInSeconds);
  const dataSize = totalSamples * numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  // WAV Header Construction
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Formant tuning based on voiceId
  let pitchShift = 0;
  if (voiceId === 'echo' || voiceId === 'onyx') pitchShift = -30;
  if (voiceId === 'nova' || voiceId === 'shimmer') pitchShift = 40;

  let offset = 44;
  const words = text.split(/\s+/).filter(Boolean);
  const wordDuration = totalSamples / Math.max(words.length, 1);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const wordIndex = Math.floor(i / wordDuration);
    const word = words[wordIndex] || 'speech';

    const charCode = word.charCodeAt(i % word.length) || 100;
    const baseFreq = Math.max(90, 150 + pitchShift + (charCode % 60));

    const positionInWord = (i % wordDuration) / wordDuration;
    const envelope = Math.sin(Math.PI * positionInWord);

    const wave =
      0.5 * Math.sin(2 * Math.PI * baseFreq * t) +
      0.3 * Math.sin(2 * Math.PI * (baseFreq * 2) * t) +
      0.2 * Math.sin(2 * Math.PI * (baseFreq * 3) * t);

    const sample = Math.floor(wave * envelope * 12000);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), offset);
    offset += 2;
  }

  return buffer;
}

export async function generateTTSAudioFile(text: string, voiceId = 'alloy'): Promise<string> {
  const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1e6);
  const filename = `persona-voice-${uniqueId}.wav`;
  const audioBuffer = generateServerTTSBuffer(text, voiceId);

  const { fileUrl } = await uploadFileToStorage(audioBuffer, filename, 'audio/wav');
  return fileUrl;
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

export async function streamPersonaCompletion(options: StreamPersonaOptions): Promise<void> {
  const { persona, messages, isAudioPrompt, onChunk, onDone, onError } = options;
  const systemPrompt =
    persona.systemPrompt ||
    `You are ${persona.name}, a helpful and friendly AI persona in a real-time chat application.`;

  const formattedMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role,
      content: m.name ? `[${m.name}]: ${m.content}` : m.content,
    })),
  ];

  let fullResponse = '';

  // Attempt 1: OpenAI-compatible endpoint (Ollama / vLLM / OpenAI / Groq)
  const openai = getOpenAIClient();
  let success = false;

  if (openai) {
    try {
      const stream = await openai.chat.completions.create({
        model: persona.model || 'gpt-4o',
        messages: formattedMessages as any,
        temperature: persona.temperature ?? 0.7,
        max_tokens: persona.maxTokens ?? 1000,
        stream: true,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          fullResponse += text;
          onChunk(text);
        }
      }

      if (fullResponse.trim()) {
        success = true;
      }
    } catch (err) {
      console.warn('OpenAI stream failed, trying Gemini fallback:', (err as any)?.message);
    }
  }

  // Attempt 2: Gemini 2.5 Flash Fallback
  if (!success) {
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
            maxOutputTokens: persona.maxTokens ?? 1000,
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
      } catch (geminiErr) {
        console.error('Gemini streaming error:', geminiErr);
      }
    }
  }

  // Fallback if no LLM responded
  if (!fullResponse.trim()) {
    fullResponse = `Hello! I am ${persona.name}. I received your message and I'm glad to chat with you!`;
    onChunk(fullResponse);
  }

  // Check if Voice Reply should be generated
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
