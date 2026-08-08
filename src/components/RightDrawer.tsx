import React from 'react';
import { X, Mic, Users, Calendar, ShieldCheck } from 'lucide-react';
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
    <div className="w-80 h-full bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 text-slate-100 z-20 shadow-xl">
      {/* Header */}
      <div className="p-4 bg-slate-950 flex items-center justify-between border-b border-slate-800">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-400">
          {activeChat.isGroup ? 'Group Info' : 'Contact Info'}
        </h3>
        <button
          onClick={toggleRightDrawer}
          className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Main Details */}
        <div className="flex flex-col items-center text-center pb-4 border-b border-slate-800">
          <img
            src={
              activeChat.isGroup
                ? `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(activeChat.name || 'Group')}`
                : otherUser?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${otherUser?.username}`
            }
            alt="Profile"
            className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500 shadow-md mb-3"
          />
          <h2 className="font-bold text-lg text-slate-100">
            {activeChat.isGroup ? activeChat.name : otherUser?.username}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeChat.isGroup
              ? `${activeChat.participants.length} participants`
              : otherUser?.email}
          </p>

          {!activeChat.isGroup && (
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <span className={`w-2 h-2 rounded-full ${isOtherOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
              <span className={isOtherOnline ? 'text-emerald-400 font-medium' : 'text-slate-400'}>
                {isOtherOnline ? 'Active Now' : 'Offline'}
              </span>
            </div>
          )}
        </div>

        {/* Group Participants */}
        {activeChat.isGroup && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              <Users className="w-4 h-4 text-emerald-500" />
              <span>Participants ({activeChat.participants.length})</span>
            </div>
            <div className="space-y-2">
              {activeChat.participants.map((participant) => {
                const isOnline = onlineUsers[participant._id]?.isOnline ?? participant.isOnline;
                return (
                  <div
                    key={participant._id}
                    className="flex items-center gap-3 p-2 bg-slate-800/50 rounded-xl"
                  >
                    <div className="relative">
                      <img
                        src={participant.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${participant.username}`}
                        alt={participant.username}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border border-slate-900 rounded-full" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-200 truncate">
                        {participant.username} {participant._id === user?._id && '(You)'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{participant.email}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Voice Notes & Media */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Mic className="w-4 h-4 text-emerald-500" />
            <span>Voice Notes ({audioMessages.length})</span>
          </div>

          {audioMessages.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No voice notes shared yet</p>
          ) : (
            <div className="space-y-2">
              {audioMessages.map((msg) => (
                <div key={msg._id} className="p-2 bg-slate-800/40 rounded-lg text-xs">
                  <div className="flex justify-between text-[10px] text-slate-400 mb-1">
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
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300">
          <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
          <p>
            Messages and calls are end-to-end encrypted. Socket.io JWT authentication protects real-time data streams.
          </p>
        </div>
      </div>
    </div>
  );
};
