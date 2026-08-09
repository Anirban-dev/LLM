import React from 'react';
import { Phone, Info, ArrowLeft, Menu } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';

export const ChatHeader: React.FC = () => {
  const {
    activeChatId,
    chats,
    user,
    onlineUsers,
    toggleRightDrawer,
    toggleMobileSidebar,
    deselectChat,
    initiateCall,
  } = useChatStore();

  const activeChat = chats.find((c) => c._id === activeChatId);
  if (!activeChat) return null;

  const otherUser = activeChat.isGroup
    ? null
    : activeChat.participants.find((p) => p._id !== user?._id);

  const title = activeChat.isGroup
    ? activeChat.name || 'Group Chat'
    : otherUser?.username || 'Chat';

  const avatar = activeChat.isGroup
    ? `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(title)}`
    : otherUser?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(title)}`;

  const isOnline = otherUser ? onlineUsers[otherUser._id]?.isOnline ?? otherUser.isOnline : false;

  return (
    <div className="px-4 py-3 bg-[#f0f2f5] border-b border-gray-200 flex items-center justify-between shrink-0 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleMobileSidebar}
          className="md:hidden p-1.5 hover:bg-gray-200 rounded-lg text-gray-600"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={deselectChat}
          className="hidden md:flex p-1.5 hover:bg-gray-200 rounded-lg text-gray-600"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="relative">
          <img src={avatar} alt={title} className="w-10 h-10 rounded-full object-cover border border-gray-200" />
          {!activeChat.isGroup && (
            <div
              className={`w-3 h-3 rounded-full absolute bottom-0 right-0 border-2 border-white ${
                isOnline ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            />
          )}
        </div>

        <div>
          <h2 className="font-bold text-gray-900 text-sm">{title}</h2>
          <p className="text-xs text-gray-500">
            {activeChat.isGroup
              ? `${activeChat.participants.length} members`
              : isOnline
              ? 'Online'
              : 'Offline'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {otherUser && (
          <button
            onClick={() => initiateCall(otherUser._id)}
            className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
            title="Voice Call"
          >
            <Phone className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={toggleRightDrawer}
          className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
          title="Chat Info"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
