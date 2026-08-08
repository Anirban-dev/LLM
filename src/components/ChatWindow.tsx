import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MoreVertical, Phone, Video, Info, Smile } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { AudioPlayer } from './AudioPlayer';
import { AudioRecorder } from './AudioRecorder';

export const ChatWindow: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    user,
    chats,
    activeChatId,
    messages,
    sendMessage,
    startTyping,
    stopTyping,
    typingUsers,
    onlineUsers,
    toggleRightDrawer,
  } = useChatStore();

  const activeChat = chats.find((c) => c._id === activeChatId);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  if (!activeChat) {
    return (
      <div className="flex-1 h-full bg-slate-950 flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4 shadow-lg border border-emerald-500/20">
          <Send className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-slate-200 mb-2">WhatsApp Web Chat</h2>
        <p className="text-sm max-w-sm text-slate-400">
          Select a conversation from the left sidebar or click <span className="text-emerald-400 font-semibold">New Chat</span> to message a contact in real-time.
        </p>
      </div>
    );
  }

  const otherUser = activeChat.isGroup ? null : activeChat.participants.find((p) => p._id !== user?._id);
  const isOtherOnline = otherUser ? onlineUsers[otherUser._id]?.isOnline ?? otherUser.isOnline : false;

  const currentTyping = typingUsers[activeChat._id] || [];
  const isTyping = currentTyping.length > 0;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    startTyping();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');
    stopTyping();
    await sendMessage(text);
  };

  const getSenderDetails = (senderId: any) => {
    if (typeof senderId === 'object' && senderId !== null) {
      return {
        id: senderId._id,
        name: senderId.username,
        avatar: senderId.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${senderId.username}`,
      };
    }
    const found = activeChat.participants.find((p) => p._id === senderId);
    return {
      id: senderId,
      name: found?.username || 'User',
      avatar: found?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${found?.username || 'User'}`,
    };
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-950 text-slate-100 min-w-0 relative">
      {/* Active Chat Header */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={toggleRightDrawer}>
          <div className="relative shrink-0">
            <img
              src={
                activeChat.isGroup
                  ? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(activeChat.name || 'Group')}`
                  : otherUser?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${otherUser?.username}`
              }
              alt="Chat Avatar"
              className="w-10 h-10 rounded-full object-cover border border-slate-700"
            />
            {!activeChat.isGroup && isOtherOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-slate-100 truncate">
              {activeChat.isGroup ? activeChat.name : otherUser?.username}
            </h3>
            <div className="text-xs text-slate-400 truncate">
              {isTyping ? (
                <span className="text-emerald-400 font-semibold animate-pulse">
                  {currentTyping.join(', ')} typing...
                </span>
              ) : activeChat.isGroup ? (
                `${activeChat.participants.length} participants`
              ) : isOtherOnline ? (
                <span className="text-emerald-400 font-medium">Online</span>
              ) : (
                'Offline'
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-300">
          <button
            onClick={toggleRightDrawer}
            className="p-2 hover:bg-slate-800 rounded-full hover:text-white transition-colors"
            title="Chat Info"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Message Feed Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-2xl text-center text-xs text-slate-400 max-w-xs shadow-lg">
              🔒 End-to-end encrypted. No messages here yet. Say hi or record a voice note!
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const sender = getSenderDetails(msg.senderId);
            const isMe = sender.id === user?._id;

            return (
              <div
                key={msg._id}
                className={`flex gap-2.5 max-w-[85%] sm:max-w-[70%] ${
                  isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {!isMe && (
                  <img
                    src={sender.avatar}
                    alt={sender.name}
                    className="w-8 h-8 rounded-full object-cover shrink-0 self-end border border-slate-700"
                  />
                )}

                <div
                  className={`p-3 rounded-2xl shadow-sm relative group ${
                    isMe
                      ? 'bg-emerald-600 text-white rounded-br-none'
                      : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/60'
                  }`}
                >
                  {/* Sender Name in group */}
                  {!isMe && activeChat.isGroup && (
                    <div className="text-[11px] font-bold text-emerald-400 mb-1">{sender.name}</div>
                  )}

                  {/* Message Content */}
                  {msg.type === 'audio' ? (
                    <AudioPlayer src={msg.mediaUrl || ''} duration={msg.duration} isSender={isMe} />
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  )}

                  {/* Timestamp */}
                  <div
                    className={`text-[10px] mt-1 font-mono text-right opacity-70 ${
                      isMe ? 'text-emerald-100' : 'text-slate-400'
                    }`}
                  >
                    {formatTime(msg.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator bubble */}
        {isTyping && (
          <div className="flex gap-2 items-center mr-auto">
            <div className="p-3 bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none text-xs text-slate-300 flex items-center gap-1.5 shadow">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Footer */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 shrink-0">
        {isRecordingMode ? (
          <AudioRecorder onClose={() => setIsRecordingMode(false)} />
        ) : (
          <form onSubmit={handleSendText} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRecordingMode(true)}
              className="p-2.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-full transition-colors shrink-0"
              title="Record Voice Note"
            >
              <Mic className="w-5 h-5" />
            </button>

            <input
              type="text"
              placeholder="Type a message..."
              value={inputText}
              onChange={handleInputChange}
              className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-full text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow transition-transform active:scale-95 disabled:opacity-50 shrink-0"
              title="Send Message"
            >
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
