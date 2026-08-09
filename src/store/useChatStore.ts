import { create } from 'zustand';
import { io } from 'socket.io-client';
import { AuthSlice, createAuthSlice } from './slices/authSlice';
import { UISlice, createUISlice } from './slices/uiSlice';
import { CallSlice, createCallSlice } from './slices/callSlice';
import { ChatSlice, createChatSlice } from './slices/chatSlice';

import { User } from '../types';

export type ChatStore = AuthSlice & UISlice & CallSlice & ChatSlice & {
  initializeSocket: (overrideToken?: string) => void;
  initSocket: (overrideToken?: string) => void;
  disconnectSocket: () => void;
  fetchChats: () => Promise<void>;
  createDirectChat: (recipientId: string) => Promise<void>;
  createGroupChat: (name: string, participantIds: string[]) => Promise<void>;
  uploadAudioVoiceNote: (audioBlob: Blob, durationSec: number) => Promise<void>;
  sendMessage: (
    data:
      | string
      | {
          type?: 'text' | 'audio' | 'image' | 'video' | 'document';
          content?: string;
          mediaUrl?: string;
          fileName?: string;
          fileSize?: number;
          duration?: number;
        }
  ) => Promise<void>;
  startTyping: () => void;
  stopTyping: () => void;
  speakText: (text: string) => Promise<string | void>;
  initiateCall: (recipient: string | User) => void;
};

export const useChatStore = create<ChatStore>((set, get, store) => ({
  ...createAuthSlice(set, get, store),
  ...createUISlice(set, get, store),
  ...createCallSlice(set, get, store),
  ...createChatSlice(set, get, store),

  initializeSocket: (overrideToken) => {
    const token = overrideToken || get().token;
    const existingSocket = get().socket;
    if (!token || existingSocket) return;

    const socket = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('⚡ Socket connected to server');
    });

    socket.on('receive_message', (message: any) => {
      const { activeChatId, addMessage } = get();
      if (message.chatId === activeChatId) {
        addMessage(message);
      }
    });

    socket.on('user_status_change', ({ userId, isOnline, lastSeen }) => {
      get().setUserOnlineStatus(userId, isOnline, lastSeen);
    });

    set({ socket });
  },

  initSocket: (overrideToken) => {
    get().initializeSocket(overrideToken);
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },

  fetchChats: async () => {
    const token = get().token;
    if (!token) return;
    try {
      const res = await fetch('/api/chats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const chats = await res.json();
        set({ chats });
      }
    } catch (err) {
      console.error('Fetch chats error:', err);
    }
  },

  createDirectChat: async (recipientId) => {
    const token = get().token;
    if (!token) return;
    try {
      const res = await fetch('/api/chats/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipientId }),
      });
      if (res.ok) {
        const newChat = await res.json();
        await get().fetchChats();
        set({ activeChatId: newChat._id });
      }
    } catch (err) {
      console.error('Create direct chat error:', err);
    }
  },

  createGroupChat: async (name, participantIds) => {
    const token = get().token;
    if (!token) return;
    try {
      const res = await fetch('/api/chats/group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, participantIds }),
      });
      if (res.ok) {
        const newChat = await res.json();
        await get().fetchChats();
        set({ activeChatId: newChat._id });
      }
    } catch (err) {
      console.error('Create group chat error:', err);
    }
  },

  uploadAudioVoiceNote: async (audioBlob, durationSec) => {
    const { token, activeChatId, socket } = get();
    if (!token || !activeChatId) return;

    const formData = new FormData();
    formData.append('file', audioBlob, 'voicenote.webm');

    const res = await fetch('/api/storage/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (res.ok) {
      const { url } = await res.json();
      if (socket) {
        socket.emit('send_message', {
          chatId: activeChatId,
          type: 'audio',
          mediaUrl: url,
          duration: durationSec,
          content: '🎤 Voice note',
        });
      }
    }
  },

  sendMessage: async (payload) => {
    const { socket, activeChatId } = get();
    if (!socket || !activeChatId) return;

    if (typeof payload === 'string') {
      socket.emit('send_message', { chatId: activeChatId, content: payload, type: 'text' });
    } else {
      socket.emit('send_message', { chatId: activeChatId, ...payload });
    }
  },

  startTyping: () => {
    const { socket, activeChatId } = get();
    if (socket && activeChatId) socket.emit('typing_start', activeChatId);
  },

  stopTyping: () => {
    const { socket, activeChatId } = get();
    if (socket && activeChatId) socket.emit('typing_stop', activeChatId);
  },

  speakText: async (text) => {
    if (!text) return;
    try {
      const token = get().token;
      const res = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      }
    } catch (e) {
      console.error('TTS synthesize error:', e);
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }
  },

  initiateCall: (recipient) => {
    const recipientId = typeof recipient === 'string' ? recipient : recipient._id;
    const { socket } = get();
    if (socket && recipientId) {
      set({ callStatus: 'calling' });
      socket.emit('call_user', { recipientId, offer: { type: 'voice' } });
    }
  },
}));
