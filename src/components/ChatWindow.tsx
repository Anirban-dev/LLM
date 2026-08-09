import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Phone, Info, ArrowLeft, Volume2, Check, CheckCheck, Menu } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { AudioPlayer } from './AudioPlayer';
import { AudioRecorder } from './AudioRecorder';

export const ChatWindow: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [isRecordingMode, setIsRecordingMode] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
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
    toggleMobileSidebar,
    deselectChat,
    initiateCall,
    speakText,
  } = useChatStore();

  const activeChat = chats.find((c) => c._id === activeChatId);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  if (!activeChat) {
    return (
      <div className="flex-1 h-full bg-[#f0f2f5] flex flex-col items-center justify-center p-8 text-center text-gray-500">
        <div className="w-20 h-20 rounded-full bg-[#00a884]/10 flex items-center justify-center text-[#00a884] mb-4 shadow-sm border border-[#00a884]/20">
          <Send className="w-10 h-10 ml-1" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">WhatsApp Web Chat</h2>
        <p className="text-sm max-w-sm text-gray-600">
          Select a conversation from the sidebar or start a new chat to begin messaging with real-time WebRTC calls & server-side voice processing.
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

  const handleSpeakMessage = async (msgId: string, text: string) => {
    setSpeakingMsgId(msgId);
    try {
      const audioUrl = await speakText(text);
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.onended = () => setSpeakingMsgId(null);
        await audio.play();
      } else {
        setSpeakingMsgId(null);
      }
    } catch (e) {
      console.error('Playback error:', e);
      setSpeakingMsgId(null);
    }
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
    <div className="flex-1 h-full flex flex-col bg-[#efeae2] text-gray-900 min-w-0 relative">
      {/* Active Chat Header */}
      <div className="p-3 bg-[#f0f2f5] border-b border-[#d1d7db] flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Mobile Hamburger Menu Button */}
          <button
            onClick={toggleMobileSidebar}
            className="md:hidden p-2 hover:bg-gray-200/80 rounded-full text-gray-700 transition-colors"
            title="Open Sidebar Menu"
          >
            <Menu className="w-5 h-5 text-gray-700" />
          </button>

          {/* Mobile Back Button */}
          <button
            onClick={deselectChat}
            className="md:hidden p-1.5 hover:bg-gray-200/80 rounded-full text-gray-700 transition-colors"
            title="Back to Contact List"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div
            className="flex items-center gap-3 min-w-0 cursor-pointer"
            onClick={toggleRightDrawer}
          >
            <div className="relative shrink-0">
              <img
                src={
                  activeChat.isGroup
                    ? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(activeChat.name || 'Group')}`
                    : otherUser?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${otherUser?.username}`
                }
                alt="Chat Avatar"
                className="w-10 h-10 rounded-full object-cover border border-gray-300"
              />
              {!activeChat.isGroup && isOtherOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#25d366] border-2 border-[#f0f2f5] rounded-full" />
              )}
            </div>

            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-gray-900 truncate">
                {activeChat.isGroup ? activeChat.name : otherUser?.username}
              </h3>
              <div className="text-xs text-gray-500 truncate">
                {isTyping ? (
                  <span className="text-[#00a884] font-semibold animate-pulse">
                    {currentTyping.join(', ')} typing...
                  </span>
                ) : activeChat.isGroup ? (
                  `${activeChat.participants.length} participants`
                ) : isOtherOnline ? (
                  <span className="text-[#00a884] font-medium">Online</span>
                ) : (
                  'Offline'
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Header Icons */}
        <div className="flex items-center gap-1 text-gray-600">
          {!activeChat.isGroup && otherUser && (
            <button
              onClick={() => initiateCall(otherUser)}
              className="p-2 hover:bg-gray-200/80 rounded-full hover:text-[#00a884] transition-colors"
              title="Start Voice Call"
            >
              <Phone className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={toggleRightDrawer}
            className="p-2 hover:bg-gray-200/80 rounded-full hover:text-[#00a884] transition-colors"
            title="Chat Details"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Message Feed Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(#d1d7db_1px,transparent_1px)] [background-size:16px_16px]">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="p-4 bg-white border border-[#e9edef] rounded-xl text-center text-xs text-gray-600 max-w-xs shadow-sm">
              🔒 Messages are end-to-end encrypted. Say hello or send a voice note!
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const sender = getSenderDetails(msg.senderId);
            const isMe = sender.id === user?._id;

            return (
              <div
                key={msg._id}
                className={`flex gap-2 max-w-[85%] sm:max-w-[70%] ${
                  isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {!isMe && (
                  <img
                    src={sender.avatar}
                    alt={sender.name}
                    className="w-7 h-7 rounded-full object-cover shrink-0 self-end border border-gray-300"
                  />
                )}

                <div
                  className={`p-3 rounded-2xl shadow-sm relative group ${
                    isMe
                      ? 'bg-[#d9fdd3] text-gray-900 rounded-br-none border border-[#c3f0bb]'
                      : 'bg-white text-gray-900 rounded-bl-none border border-gray-200'
                  }`}
                >
                  {/* Sender Name in group */}
                  {!isMe && activeChat.isGroup && (
                    <div className="text-[11px] font-bold text-[#00a884] mb-1">{sender.name}</div>
                  )}

                  {/* Message Content */}
                  {msg.type === 'audio' ? (
                    <div className="space-y-2">
                      <AudioPlayer src={msg.mediaUrl || ''} duration={msg.duration} isSender={isMe} />
                      {msg.content && msg.content !== '🎤 Voice note' && (
                        <p className="text-xs text-gray-700 italic bg-white/60 p-2 rounded-lg border border-gray-200/80">
                          <span className="font-semibold text-[#00a884] not-italic">Transcript:</span> "{msg.content}"
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                      
                      {/* TTS Speak Read-Aloud Button */}
                      <button
                        onClick={() => handleSpeakMessage(msg._id, msg.content || '')}
                        disabled={speakingMsgId === msg._id}
                        className="p-1 text-gray-400 hover:text-[#00a884] hover:bg-black/5 rounded transition-colors shrink-0"
                        title="Read Aloud (TTS)"
                      >
                        <Volume2 className={`w-4 h-4 ${speakingMsgId === msg._id ? 'text-[#00a884] animate-pulse' : ''}`} />
                      </button>
                    </div>
                  )}

                  {/* Timestamp & Delivery status */}
                  <div className="flex items-center justify-end gap-1 text-[10px] mt-1 font-medium text-gray-500">
                    <span>{formatTime(msg.createdAt)}</span>
                    {isMe && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator bubble */}
        {isTyping && (
          <div className="flex gap-2 items-center mr-auto">
            <div className="p-3 bg-white border border-gray-200 rounded-2xl rounded-bl-none text-xs text-gray-600 flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-[#00a884] rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Footer */}
      <div className="p-3 bg-[#f0f2f5] border-t border-[#d1d7db] shrink-0">
        {isRecordingMode ? (
          <AudioRecorder onClose={() => setIsRecordingMode(false)} />
        ) : (
          <form onSubmit={handleSendText} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsRecordingMode(true)}
              className="p-2.5 text-gray-600 hover:text-[#00a884] hover:bg-gray-200 rounded-full transition-colors shrink-0"
              title="Record Voice Note (Server STT)"
            >
              <Mic className="w-5 h-5" />
            </button>

            <input
              type="text"
              placeholder="Type a message..."
              value={inputText}
              onChange={handleInputChange}
              className="flex-1 px-4 py-2.5 bg-white border border-transparent rounded-full text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#00a884] shadow-sm"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 bg-[#00a884] hover:bg-[#008f70] text-white rounded-full shadow transition-transform active:scale-95 disabled:opacity-50 shrink-0"
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
