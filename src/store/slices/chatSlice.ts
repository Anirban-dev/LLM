import { StateCreator } from 'zustand';
import { Socket } from 'socket.io-client';
import { Chat, Message } from '../../types';

export interface ChatSlice {
  chats: Chat[];
  activeChatId: string | null;
  messages: Message[];
  socket: Socket | null;
  onlineUsers: Record<string, { isOnline: boolean; lastSeen?: string }>;
  typingUsers: Record<string, string[]>;

  setSocket: (socket: Socket | null) => void;
  setChats: (chats: Chat[]) => void;
  selectChat: (chatId: string) => void;
  deselectChat: () => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setOnlineUsers: (users: Record<string, { isOnline: boolean; lastSeen?: string }>) => void;
  setUserOnlineStatus: (userId: string, isOnline: boolean, lastSeen?: string) => void;
  setTypingUsers: (typingMap: Record<string, string[]>) => void;
}

export const createChatSlice: StateCreator<ChatSlice> = (set) => ({
  chats: [],
  activeChatId: null,
  messages: [],
  socket: null,
  onlineUsers: {},
  typingUsers: {},

  setSocket: (socket) => set({ socket }),
  setChats: (chats) => set({ chats }),

  selectChat: (chatId) => set({ activeChatId: chatId }),
  deselectChat: () => set({ activeChatId: null, messages: [] }),

  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({
      messages: state.messages.some((m) => m._id === message._id)
        ? state.messages
        : [...state.messages, message],
    })),

  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),

  setUserOnlineStatus: (userId, isOnline, lastSeen) =>
    set((state) => ({
      onlineUsers: {
        ...state.onlineUsers,
        [userId]: { isOnline, lastSeen },
      },
    })),

  setTypingUsers: (typingUsers) => set({ typingUsers }),
});
