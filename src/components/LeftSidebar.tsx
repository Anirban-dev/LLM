import React from 'react';
import { MessageSquarePlus, Users, LogOut, Search, UserCheck } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { Chat, User } from '../types';

export const LeftSidebar: React.FC = () => {
  const {
    user,
    chats,
    activeChatId,
    selectChat,
    logout,
    searchQuery,
    setSearchQuery,
    setNewChatOpen,
    setNewGroupOpen,
    onlineUsers,
  } = useChatStore();

  const getChatDetails = (chat: Chat) => {
    if (chat.isGroup) {
      return {
        name: chat.name || 'Group Chat',
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(chat.name || 'Group')}`,
        isOnline: false,
      };
    }

    const otherUser = chat.participants.find((p) => p._id !== user?._id);
    const userId = otherUser?._id;
    const isOnline = userId ? onlineUsers[userId]?.isOnline ?? otherUser?.isOnline ?? false : false;

    return {
      name: otherUser?.username || 'Unknown User',
      avatar:
        otherUser?.avatarUrl ||
        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(otherUser?.username || 'User')}`,
      isOnline,
    };
  };

  const filteredChats = chats.filter((chat) => {
    const details = getChatDetails(chat);
    return details.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full md:w-80 lg:w-96 h-full flex flex-col bg-slate-900 border-r border-slate-800 shrink-0 text-slate-100">
      {/* User Profile Header */}
      <div className="p-3 bg-slate-950 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <img
              src={user?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username}`}
              alt={user?.username}
              className="w-10 h-10 rounded-full object-cover border border-slate-700"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-slate-100 truncate">{user?.username}</div>
            <div className="text-[11px] text-emerald-400 font-mono">Online</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setNewChatOpen(true)}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            title="New Chat"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>
          <button
            onClick={() => setNewGroupOpen(true)}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            title="New Group"
          >
            <Users className="w-5 h-5" />
          </button>
          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-full transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 bg-slate-900 border-b border-slate-800/80">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-800 border border-slate-700/80 rounded-lg text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Active Chat List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
        {filteredChats.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No chats found. Click <span className="text-emerald-400">New Chat</span> to message a contact!
          </div>
        ) : (
          filteredChats.map((chat) => {
            const details = getChatDetails(chat);
            const isActive = chat._id === activeChatId;
            const lastMsg = chat.lastMessage;

            return (
              <div
                key={chat._id}
                onClick={() => selectChat(chat._id)}
                className={`p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                  isActive ? 'bg-slate-800/90 border-l-4 border-emerald-500' : 'hover:bg-slate-800/50'
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={details.avatar}
                    alt={details.name}
                    className="w-12 h-12 rounded-full object-cover border border-slate-700"
                  />
                  {details.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-medium text-sm text-slate-100 truncate">{details.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                      {formatMessageTime(chat.updatedAt)}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 truncate flex items-center gap-1">
                    {lastMsg ? (
                      <>
                        {lastMsg.type === 'audio' ? (
                          <span className="text-emerald-400 flex items-center gap-1">🎤 Voice note</span>
                        ) : (
                          <span>{lastMsg.content}</span>
                        )}
                      </>
                    ) : (
                      <span className="italic text-slate-500">No messages yet</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
