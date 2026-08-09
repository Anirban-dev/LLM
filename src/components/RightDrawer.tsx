import React from 'react';
import { X, Mic, Users, ShieldCheck } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

export const RightDrawer: React.FC = () => {
  const {
    activeChatId,
    chats,
    user,
    messages,
    isRightDrawerOpen,
    toggleRightDrawer,
    onlineUsers,
  } = useChatStore();

  const activeChat = chats.find((c) => c._id === activeChatId);

  if (!isRightDrawerOpen || !activeChat) return null;

  const otherUser = activeChat.isGroup ? null : activeChat.participants.find((p) => p._id !== user?._id);
  const isOtherOnline = otherUser ? onlineUsers[otherUser._id]?.isOnline ?? otherUser.isOnline : false;

  const audioMessages = messages.filter((m) => m.type === 'audio');

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-30 md:hidden"
        onClick={toggleRightDrawer}
      />

      <div className="fixed md:relative inset-y-0 right-0 z-40 w-full sm:w-80 h-full bg-white border-l border-[#d1d7db] flex flex-col shrink-0 text-gray-900 shadow-2xl md:shadow-none">
        {/* Header */}
      <div className="p-4 bg-[#f0f2f5] flex items-center justify-between border-b border-[#e9edef]">
        <h3 className="font-semibold text-xs uppercase tracking-wider text-gray-600">
          {activeChat.isGroup ? 'Group Info' : 'Contact Info'}
        </h3>
        <button
          onClick={toggleRightDrawer}
          className="p-1 hover:bg-gray-200 rounded-full text-gray-600 hover:text-gray-900 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Main Details */}
        <div className="flex flex-col items-center text-center pb-4 border-b border-[#e9edef]">
          <img
            src={
              activeChat.isGroup
                ? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(activeChat.name || 'Group')}`
                : otherUser?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${otherUser?.username}`
            }
            alt="Profile"
            className="w-20 h-20 rounded-full object-cover border-2 border-[#00a884] shadow-md mb-3"
          />
          <h2 className="font-bold text-lg text-gray-900">
            {activeChat.isGroup ? activeChat.name : otherUser?.username}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {activeChat.isGroup
              ? `${activeChat.participants.length} participants`
              : otherUser?.email}
          </p>

          {!activeChat.isGroup && (
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <span className={`w-2 h-2 rounded-full ${isOtherOnline ? 'bg-[#25d366] animate-pulse' : 'bg-gray-400'}`} />
              <span className={isOtherOnline ? 'text-[#00a884] font-semibold' : 'text-gray-500'}>
                {isOtherOnline ? 'Active Now' : 'Offline'}
              </span>
            </div>
          )}
        </div>

        {/* Group Participants */}
        {activeChat.isGroup && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <Users className="w-4 h-4 text-[#00a884]" />
              <span>Participants ({activeChat.participants.length})</span>
            </div>
            <div className="space-y-2">
              {activeChat.participants.map((participant) => {
                const isOnline = onlineUsers[participant._id]?.isOnline ?? participant.isOnline;
                return (
                  <div
                    key={participant._id}
                    className="flex items-center gap-3 p-2 bg-[#f0f2f5] rounded-xl border border-[#e9edef]"
                  >
                    <div className="relative">
                      <img
                        src={participant.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${participant.username}`}
                        alt={participant.username}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#25d366] border border-white rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">
                        {participant.username} {participant._id === user?._id && '(You)'}
                      </div>
                      <div className="text-[10px] text-gray-500 truncate">{participant.email}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Voice Notes & Media */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <Mic className="w-4 h-4 text-[#00a884]" />
            <span>Voice Notes ({audioMessages.length})</span>
          </div>

          {audioMessages.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No voice notes shared yet</p>
          ) : (
            <div className="space-y-2">
              {audioMessages.map((msg) => (
                <div key={msg._id} className="p-2.5 bg-[#f0f2f5] rounded-xl text-xs border border-[#e9edef]">
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1 font-mono">
                    <span>
                      {typeof msg.senderId === 'object' ? msg.senderId.username : 'User'}
                    </span>
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {msg.mediaUrl && <audio src={msg.mediaUrl} controls className="w-full h-8" />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Security / Encryption Notice */}
        <div className="p-3 bg-[#e8f8f5] border border-[#00a884]/30 rounded-xl flex items-start gap-2.5 text-xs text-[#006e56]">
          <ShieldCheck className="w-5 h-5 shrink-0 text-[#00a884] mt-0.5" />
          <p>
            Messages and WebRTC 1-on-1 calls are end-to-end encrypted with Socket.io JWT authentication.
          </p>
        </div>
      </div>
    </div>
  </>
);
};
