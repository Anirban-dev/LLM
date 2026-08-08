import mongoose, { Schema, Document } from 'mongoose';

export interface IChat extends Document {
  isGroup: boolean;
  name?: string;
  participants: mongoose.Types.ObjectId[];
  personaParticipants?: mongoose.Types.ObjectId[];
  lastMessage?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    isGroup: { type: Boolean, default: false },
    name: { type: String, default: '' },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    personaParticipants: [{ type: Schema.Types.ObjectId, ref: 'Persona' }],
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
  },
  { timestamps: true }
);

export const Chat = mongoose.model<IChat>('Chat', ChatSchema);

