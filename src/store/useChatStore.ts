import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { User, Chat, Message, CallStatus } from '../types';

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
  isPersonaModalOpen: boolean;
  isMobileSidebarOpen: boolean;
  isAndroidModalOpen: boolean;

  // WebRTC Call State
  callStatus: CallStatus;
  incomingCaller: User | null;
  activeCallPeer: User | null;
  incomingOffer: any | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  callDuration: number;

  // Actions
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  initSocket: (token: string) => void;
  disconnectSocket: () => void;
  
  fetchChats: () => Promise<void>;
  selectChat: (chatId: string) => Promise<void>;
  deselectChat: () => void;
  createDirectChat: (recipientId: string) => Promise<Chat | null>;
  createGroupChat: (name: string, participantIds: string[]) => Promise<Chat | null>;
  
  fetchMessages: (chatId: string) => Promise<void>;
  sendMessage: (content?: string, mediaUrl?: string, duration?: number) => Promise<void>;
  uploadAudioVoiceNote: (audioBlob: Blob, duration: number) => Promise<void>;
  speakText: (text: string) => Promise<string | null>;
  
  startTyping: () => void;
  stopTyping: () => void;
  
  toggleRightDrawer: () => void;
  setSearchQuery: (query: string) => void;
  setNewChatOpen: (isOpen: boolean) => void;
  setNewGroupOpen: (isOpen: boolean) => void;
  setPersonaModalOpen: (isOpen: boolean) => void;
  setMobileSidebarOpen: (isOpen: boolean) => void;
  setAndroidModalOpen: (isOpen: boolean) => void;
  toggleMobileSidebar: () => void;

  // WebRTC Call Actions
  initiateCall: (recipient: User) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  setRemoteStream: (stream: MediaStream | null) => void;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

let callTimerInterval: any = null;

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
  isPersonaModalOpen: false,
  isMobileSidebarOpen: false,
  isAndroidModalOpen: false,

  // Call initial state
  callStatus: 'idle',
  incomingCaller: null,
  activeCallPeer: null,
  incomingOffer: null,
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  isMuted: false,
  isSpeakerOn: true,
  callDuration: 0,

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
        if (!messages.some((m) => m._id === message._id)) {
          set({ messages: [...messages, message] });
        }
      }
      get().fetchChats();
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

    // =============================
    // WebRTC Socket Listeners
    // =============================

    socket.on('incoming_call', ({ caller, offer }) => {
      console.log('📞 Incoming WebRTC call from', caller.username);
      set({
        callStatus: 'incoming',
        incomingCaller: caller,
        incomingOffer: offer,
      });
    });

    socket.on('call_accepted', async ({ answer }) => {
      console.log('✅ Call accepted by peer');
      const { peerConnection } = get();
      if (peerConnection && answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        set({ callStatus: 'connected', callDuration: 0 });

        if (callTimerInterval) clearInterval(callTimerInterval);
        callTimerInterval = setInterval(() => {
          set((state) => ({ callDuration: state.callDuration + 1 }));
        }, 1000);
      }
    });

    socket.on('call_declined', ({ username }) => {
      console.log('❌ Call was declined by', username);
      get().endCall();
    });

    socket.on('ice_candidate', async ({ candidate }) => {
      const { peerConnection } = get();
      if (peerConnection && candidate) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      }
    });

    socket.on('call_ended', () => {
      console.log('🛑 Call ended by peer');
      get().endCall();
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

    set({ activeChatId: chatId, isMobileSidebarOpen: false });
    if (socket) {
      socket.emit('join_chat', chatId);
    }
    await fetchMessages(chatId);
  },

  deselectChat: () => {
    const { socket, activeChatId } = get();
    if (activeChatId && socket) {
      socket.emit('leave_chat', activeChatId);
    }
    set({ activeChatId: null, messages: [], isMobileSidebarOpen: false });
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

    if (socket && socket.connected) {
      socket.emit('send_message', {
        chatId: activeChatId,
        type,
        content,
        mediaUrl,
        duration,
      });
    } else if (token) {
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

  // Upload Voice Note with Server-Side STT transcription
  uploadAudioVoiceNote: async (audioBlob, duration) => {
    const { token, sendMessage } = get();
    if (!token) return;

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, `voice-${Date.now()}.webm`);
      formData.append('duration', duration.toString());

      const res = await fetch('/api/messages/upload-audio', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const { mediaUrl, transcript } = data;
        await sendMessage(transcript || '🎤 Voice note', mediaUrl, duration);
      }
    } catch (err) {
      console.error('Voice note upload error:', err);
    }
  },

  // TTS Generation Endpoint caller
  speakText: async (text: string) => {
    const { token } = get();
    if (!token || !text) return null;

    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        const data = await res.json();
        return data.audioUrl as string;
      }
    } catch (err) {
      console.error('TTS generation request failed:', err);
    }
    return null;
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
  setPersonaModalOpen: (isPersonaModalOpen) => set({ isPersonaModalOpen }),
  setMobileSidebarOpen: (isMobileSidebarOpen) => set({ isMobileSidebarOpen }),
  setAndroidModalOpen: (isAndroidModalOpen) => set({ isAndroidModalOpen }),
  toggleMobileSidebar: () => set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),

  // =============================
  // WebRTC Voice Call Actions
  // =============================

  initiateCall: async (recipient: User) => {
    const { socket, user } = get();
    if (!socket || !recipient) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const pc = new RTCPeerConnection(ICE_SERVERS);

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice_candidate', {
            targetId: recipient._id,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          set({ remoteStream: event.streams[0] });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call_user', {
        recipientId: recipient._id,
        offer,
      });

      set({
        callStatus: 'calling',
        activeCallPeer: recipient,
        localStream: stream,
        peerConnection: pc,
        isMuted: false,
      });
    } catch (err) {
      console.error('Error initiating WebRTC call:', err);
    }
  },

  acceptCall: async () => {
    const { socket, incomingCaller, incomingOffer } = get();
    if (!socket || !incomingCaller || !incomingOffer) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const pc = new RTCPeerConnection(ICE_SERVERS);

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('ice_candidate', {
            targetId: incomingCaller._id,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          set({ remoteStream: event.streams[0] });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('call_accepted', {
        callerId: incomingCaller._id,
        answer,
      });

      if (callTimerInterval) clearInterval(callTimerInterval);
      callTimerInterval = setInterval(() => {
        set((state) => ({ callDuration: state.callDuration + 1 }));
      }, 1000);

      set({
        callStatus: 'connected',
        activeCallPeer: incomingCaller,
        localStream: stream,
        peerConnection: pc,
        incomingCaller: null,
        incomingOffer: null,
        callDuration: 0,
        isMuted: false,
      });
    } catch (err) {
      console.error('Error accepting call:', err);
    }
  },

  declineCall: () => {
    const { socket, incomingCaller } = get();
    if (socket && incomingCaller) {
      socket.emit('call_declined', { callerId: incomingCaller._id });
    }
    set({
      callStatus: 'idle',
      incomingCaller: null,
      incomingOffer: null,
    });
  },

  endCall: () => {
    const { socket, activeCallPeer, peerConnection, localStream } = get();

    if (socket && activeCallPeer) {
      socket.emit('end_call', { targetId: activeCallPeer._id });
    }

    if (callTimerInterval) {
      clearInterval(callTimerInterval);
      callTimerInterval = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    if (peerConnection) {
      peerConnection.close();
    }

    set({
      callStatus: 'idle',
      incomingCaller: null,
      incomingOffer: null,
      activeCallPeer: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      callDuration: 0,
      isMuted: false,
    });
  },

  toggleMute: () => {
    const { localStream, isMuted } = get();
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted; // Toggle enabled
      });
      set({ isMuted: !isMuted });
    }
  },

  toggleSpeaker: () => {
    set((state) => ({ isSpeakerOn: !state.isSpeakerOn }));
  },

  setRemoteStream: (remoteStream) => set({ remoteStream }),
}));
