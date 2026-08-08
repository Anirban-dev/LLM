import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { User, Chat, Message } from '../types';

interface ChatStore {
  user: User | null;
  token: string | null;
  chats: Chat[];
  activeChatId: string | null;
  messages: Message[];
  socket: Socket | null;
  onlineUsers: Record<string, { isOnline: boolean; lastSeen?: string }>;
  typingUsers: Record<string, string[]>; // chatId -> usernames
  isRightDrawerOpen: boolean;
  searchQuery: string;
  isNewChatOpen: boolean;
  isNewGroupOpen: boolean;

  // Actions
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  initSocket: (token: string) => void;
  disconnectSocket: () => void;
  
  fetchChats: () => Promise<void>;
  selectChat: (chatId: string) => Promise<void>;
  createDirectChat: (recipientId: string) => Promise<Chat | null>;
  createGroupChat: (name: string, participantIds: string[]) => Promise<Chat | null>;
  
  fetchMessages: (chatId: string) => Promise<void>;
  sendMessage: (content?: string, mediaUrl?: string, duration?: number) => Promise<void>;
  
  startTyping: () => void;
  stopTyping: () => void;
  
  toggleRightDrawer: () => void;
  setSearchQuery: (query: string) => void;
  setNewChatOpen: (isOpen: boolean) => void;
  setNewGroupOpen: (isOpen: boolean) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  user: JSON.parse(localStorage.getItem('chat_user') || 'null'),
  token: localStorage.getItem('chat_token') || null,
  chats: [],
  activeChatId: null,
  messages: [],
  socket: null,
  onlineUsers: {},
  typingUsers: {},
  isRightDrawerOpen: false,
  searchQuery: '',
  isNewChatOpen: false,
  isNewGroupOpen: false,

  setAuth: (token, user) => {
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_user', JSON.stringify(user));
    set({ token, user });
    get().initSocket(token);
    get().fetchChats();
  },

  logout: () => {
    get().disconnectSocket();
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    set({
      user: null,
      token: null,
      chats: [],
      activeChatId: null,
      messages: [],
      socket: null,
      onlineUsers: {},
      typingUsers: {},
    });
  },

  initSocket: (token) => {
    if (get().socket) {
      get().socket?.disconnect();
    }

    const socket = io('/', {
      auth: { token },
      reconnection: true,
    });

    socket.on('connect', () => {
      console.log('Socket connected successfully');
    });

    // Real-time message receiver
    socket.on('receive_message', (message: Message) => {
      const { activeChatId, messages } = get();
      if (message.chatId === activeChatId) {
        // Idempotency check: avoid adding duplicate
        if (!messages.some((m) => m._id === message._id)) {
          set({ messages: [...messages, message] });
        }
      }
      get().fetchChats(); // Refresh chat list last messages
    });

    // Real-time chat list update
    socket.on('chat_updated', (updatedChat: Chat) => {
      const { chats } = get();
      const existingIndex = chats.findIndex((c) => c._id === updatedChat._id);
      let newChats = [...chats];
      if (existingIndex >= 0) {
        newChats[existingIndex] = updatedChat;
      } else {
        newChats.unshift(updatedChat);
      }
      // Sort chats by updatedAt
      newChats.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      set({ chats: newChats });
    });

    // User status change
    socket.on('user_status_change', ({ userId, isOnline, lastSeen }) => {
      set((state) => ({
        onlineUsers: {
          ...state.onlineUsers,
          [userId]: { isOnline, lastSeen },
        },
      }));
    });

    // Typing indicators
    socket.on('user_typing_start', ({ chatId, username }) => {
      set((state) => {
        const currentList = state.typingUsers[chatId] || [];
        if (!currentList.includes(username)) {
          return {
            typingUsers: {
              ...state.typingUsers,
              [chatId]: [...currentList, username],
            },
          };
        }
        return {};
      });
    });

    socket.on('user_typing_stop', ({ chatId, username }) => {
      set((state) => {
        const currentList = state.typingUsers[chatId] || [];
        return {
          typingUsers: {
            ...state.typingUsers,
            [chatId]: currentList.filter((u) => u !== username),
          },
        };
      });
    });

    set({ socket });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },

  fetchChats: async () => {
    const { token } = get();
    if (!token) return;

    try {
      const res = await fetch('/api/chats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const chats = await res.json();
        set({ chats });

        // Update online status map for participants
        const onlineMap: Record<string, { isOnline: boolean; lastSeen?: string }> = {};
        chats.forEach((chat: Chat) => {
          chat.participants.forEach((p) => {
            onlineMap[p._id] = {
              isOnline: p.isOnline,
              lastSeen: p.lastSeen,
            };
          });
        });
        set((state) => ({ onlineUsers: { ...state.onlineUsers, ...onlineMap } }));
      }
    } catch (err) {
      console.error('Fetch chats error:', err);
    }
  },

  selectChat: async (chatId) => {
    const { socket, activeChatId, fetchMessages } = get();
    if (activeChatId && socket) {
      socket.emit('leave_chat', activeChatId);
    }

    set({ activeChatId: chatId });
    if (socket) {
      socket.emit('join_chat', chatId);
    }
    await fetchMessages(chatId);
  },

  createDirectChat: async (recipientId) => {
    const { token, fetchChats, selectChat } = get();
    if (!token) return null;

    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipientId }),
      });

      if (res.ok) {
        const chat = await res.json();
        await fetchChats();
        await selectChat(chat._id);
        return chat;
      }
    } catch (err) {
      console.error('Create direct chat error:', err);
    }
    return null;
  },

  createGroupChat: async (name, participantIds) => {
    const { token, fetchChats, selectChat } = get();
    if (!token) return null;

    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isGroup: true, name, participantIds }),
      });

      if (res.ok) {
        const chat = await res.json();
        await fetchChats();
        await selectChat(chat._id);
        return chat;
      }
    } catch (err) {
      console.error('Create group chat error:', err);
    }
    return null;
  },

  fetchMessages: async (chatId) => {
    const { token } = get();
    if (!token) return;

    try {
      const res = await fetch(`/api/messages/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const messages = await res.json();
        set({ messages });
      }
    } catch (err) {
      console.error('Fetch messages error:', err);
    }
  },

  sendMessage: async (content = '', mediaUrl = '', duration = 0) => {
    const { socket, activeChatId, token } = get();
    if (!activeChatId) return;

    const type = mediaUrl ? 'audio' : 'text';

    // Prefer Socket.io for immediate real-time delivery
    if (socket && socket.connected) {
      socket.emit('send_message', {
        chatId: activeChatId,
        type,
        content,
        mediaUrl,
        duration,
      });
    } else if (token) {
      // Fallback REST POST
      try {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            chatId: activeChatId,
            type,
            content,
            mediaUrl,
            duration,
          }),
        });

        if (res.ok) {
          const message = await res.json();
          set((state) => ({ messages: [...state.messages, message] }));
          get().fetchChats();
        }
      } catch (err) {
        console.error('REST send message error:', err);
      }
    }
  },

  startTyping: () => {
    const { socket, activeChatId } = get();
    if (socket && activeChatId) {
      socket.emit('typing_start', activeChatId);
    }
  },

  stopTyping: () => {
    const { socket, activeChatId } = get();
    if (socket && activeChatId) {
      socket.emit('typing_stop', activeChatId);
    }
  },

  toggleRightDrawer: () => set((state) => ({ isRightDrawerOpen: !state.isRightDrawerOpen })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setNewChatOpen: (isNewChatOpen) => set({ isNewChatOpen }),
  setNewGroupOpen: (isNewGroupOpen) => set({ isNewGroupOpen }),
}));
