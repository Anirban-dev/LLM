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

export interface IPersona extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  bio: IPersonaBio;
  style: IPersonaStyle;
  stances?: string[];
  rawSummary?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PersonaSchema = new Schema<IPersona>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true },
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
