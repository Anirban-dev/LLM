import mongoose, { Schema, Document } from 'mongoose';

export interface IPersonaBio {
  occupation?: string;
  hobbies?: string[];
  facts?: string[];
  relationships?: string[];
}

export interface IPersonaStyle {
  tone?: string;
  punctuation?: string;
  frequently_used_phrases?: string[];
  emoji_usage?: string;
}

export interface IVoiceSettings {
  voiceId: string;
  speed: number;
  autoVoiceReply: boolean;
}

export interface IPersona extends Omit<Document, 'model'> {
  creatorId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  name: string;
  tagline?: string;
  avatarUrl?: string;
  category?: string;
  systemPrompt?: string;
  greetingMessage?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  voiceSettings?: IVoiceSettings;
  isPublic?: boolean;
  
  // Legacy / Clone fields
  bio?: IPersonaBio;
  style?: IPersonaStyle;
  stances?: string[];
  rawSummary?: string;

  createdAt: Date;
  updatedAt: Date;
}

const PersonaSchema = new Schema<IPersona>(
  {
    creatorId: { type: Schema.Types.ObjectId, ref: 'User' },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    tagline: { type: String, default: 'AI Conversation Partner' },
    avatarUrl: { type: String, default: '' },
    category: { type: String, default: 'Assistant' },
    systemPrompt: { type: String, default: 'You are a helpful, friendly, and engaging AI persona.' },
    greetingMessage: { type: String, default: 'Hello! How can I assist you today?' },
    model: { type: String, default: 'gpt-4o' },
    temperature: { type: Number, default: 0.7 },
    maxTokens: { type: Number, default: 1000 },
    voiceSettings: {
      voiceId: { type: String, default: 'alloy' },
      speed: { type: Number, default: 1.0 },
      autoVoiceReply: { type: Boolean, default: false },
    },
    isPublic: { type: Boolean, default: true },

    // Legacy Clone Fields
    bio: {
      occupation: { type: String, default: '' },
      hobbies: [{ type: String }],
      facts: [{ type: String }],
      relationships: [{ type: String }],
    },
    style: {
      tone: { type: String, default: 'casual and friendly' },
      punctuation: { type: String, default: 'standard' },
      frequently_used_phrases: [{ type: String }],
      emoji_usage: { type: String, default: 'occasional' },
    },
    stances: [{ type: String }],
    rawSummary: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Persona = mongoose.model<IPersona>('Persona', PersonaSchema);

