export interface User {
  _id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeen?: string;
  createdAt?: string;
}

export interface Message {
  _id: string;
  chatId: string;
  senderId: User | string;
  type: 'text' | 'audio';
  content?: string;
  mediaUrl?: string;
  duration?: number;
  createdAt: string;
}

export interface Chat {
  _id: string;
  isGroup: boolean;
  name?: string;
  participants: User[];
  lastMessage?: Message;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
