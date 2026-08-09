import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  chatId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  senderType: 'User' | 'Persona';
  senderPersona?: mongoose.Types.ObjectId;
  type: 'text' | 'audio' | 'image' | 'video' | 'document';
  content?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, required: true },
    senderType: { type: String, enum: ['User', 'Persona'], default: 'User' },
    senderPersona: { type: Schema.Types.ObjectId, ref: 'Persona' },
    type: { type: String, enum: ['text', 'audio', 'image', 'video', 'document'], default: 'text' },
    content: { type: String, default: '' },
    mediaUrl: { type: String, default: '' },
    fileName: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Message = mongoose.model<IMessage>('Message', MessageSchema);

