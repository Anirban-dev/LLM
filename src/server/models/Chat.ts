import mongoose, { Schema, Document } from 'mongoose';

export interface IChat extends Document {
  isGroup: boolean;
  name?: string;
  participants: mongoose.Types.ObjectId[];
  lastMessage?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSchema = new Schema<IChat>(
  {
    isGroup: { type: Boolean, default: false },
    name: { type: String, default: '' },
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
  },
  { timestamps: true }
);

export const Chat = mongoose.model<IChat>('Chat', ChatSchema);
