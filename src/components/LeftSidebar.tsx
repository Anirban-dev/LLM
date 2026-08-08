import React from 'react';
import { MessageSquarePlus, Users, LogOut, Search, BrainCircuit, X, Smartphone } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { Chat } from '../types';

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
    setPersonaModalOpen,
    setMobileSidebarOpen,
    setAndroidModalOpen,
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
    <div className="w-full md:w-80 lg:w-96 h-full flex flex-col bg-white border-r border-[#d1d7db] shrink-0 text-gray-900">
      {/* User Profile Header */}
      <div className="p-3 bg-[#f0f2f5] flex items-center justify-between border-b border-[#e9edef]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <img
              src={user?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username}`}
              alt={user?.username}
              className="w-10 h-10 rounded-full object-cover border border-gray-300"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#25d366] border-2 border-[#f0f2f5] rounded-full" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-gray-900 truncate">{user?.username}</div>
            <div className="text-xs text-[#00a884] font-medium">Online</div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setAndroidModalOpen(true)}
            className="p-1.5 text-gray-600 hover:text-[#00a884] hover:bg-gray-200/60 rounded-full transition-colors"
            title="Install as Android App"
          >
            <Smartphone className="w-5 h-5 text-emerald-600" />
          </button>
          <button
            onClick={() => setPersonaModalOpen(true)}
            className="p-1.5 text-[#00a884] hover:bg-[#00a884]/10 rounded-full transition-colors relative"
            title="AI Persona & Clone Engine"
          >
            <BrainCircuit className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#00a884] rounded-full animate-pulse" />
          </button>
          <button
            onClick={() => setNewChatOpen(true)}
            className="p-1.5 text-gray-600 hover:text-[#00a884] hover:bg-gray-200/60 rounded-full transition-colors"
            title="New Chat"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>
          <button
            onClick={() => setNewGroupOpen(true)}
            className="p-1.5 text-gray-600 hover:text-[#00a884] hover:bg-gray-200/60 rounded-full transition-colors"
            title="New Group"
          >
            <Users className="w-5 h-5" />
          </button>
          <button
            onClick={logout}
            className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-gray-200/60 rounded-full transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden p-1.5 text-gray-600 hover:bg-gray-200/80 rounded-full transition-colors"
            title="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-2.5 bg-white border-b border-[#e9edef]">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-[#f0f2f5] border border-transparent rounded-lg text-xs text-gray-900 placeholder-gray-500 focus:outline-none focus:bg-white focus:border-[#00a884]"
          />
        </div>
      </div>

      {/* Active Chat List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#f0f2f5]">
        {filteredChats.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-xs">
            No chats found. Click <span className="text-[#00a884] font-semibold">New Chat</span> to message a contact!
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
                className={`p-3 flex items-center gap-3 cursor-pointer transition-all ${
                  isActive
                    ? 'bg-[#f0f2f5] border-l-4 border-[#00a884]'
                    : 'hover:bg-[#f5f6f6]'
                }`}
              >
                <div className="relative shrink-0">
                  <img
                    src={details.avatar}
                    alt={details.name}
                    className="w-12 h-12 rounded-full object-cover border border-gray-200"
                  />
                  {details.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25d366] border-2 border-white rounded-full" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-semibold text-sm text-gray-900 truncate">{details.name}</span>
                    <span className="text-[11px] text-gray-400 font-medium shrink-0 ml-2">
                      {formatMessageTime(chat.updatedAt)}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                    {lastMsg ? (
                      <>
                        {lastMsg.type === 'audio' ? (
                          <span className="text-[#00a884] font-medium flex items-center gap-1">
                            🎤 Voice note
                          </span>
                        ) : (
                          <span className="truncate">{lastMsg.content}</span>
                        )}
                      </>
                    ) : (
                      <span className="italic text-gray-400">No messages yet</span>
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
