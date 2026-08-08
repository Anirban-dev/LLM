import React, { useState, useEffect } from 'react';
import { Search, X, MessageSquarePlus, UserCheck } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { User } from '../types';

export const NewChatModal: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const { token, isNewChatOpen, setNewChatOpen, createDirectChat } = useChatStore();

  useEffect(() => {
    if (isNewChatOpen && token) {
      fetchUsers();
    }
  }, [isNewChatOpen, search]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/users?search=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = async (userId: string) => {
    await createDirectChat(userId);
    setNewChatOpen(false);
  };

  if (!isNewChatOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100">
        <div className="p-4 bg-[#00a884] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5" />
            <h3 className="font-semibold text-base">New Direct Chat</h3>
          </div>
          <button
            onClick={() => setNewChatOpen(false)}
            className="p-1 hover:bg-[#008f70] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-white border-b border-[#e9edef]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#f0f2f5] border border-transparent rounded-lg text-sm text-gray-900 focus:outline-none focus:bg-white focus:border-[#00a884]"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-[#f0f2f5]">
          {loading ? (
            <div className="p-8 text-center text-gray-500 text-xs">Loading contacts...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-xs">No users found</div>
          ) : (
            users.map((u) => (
              <button
                key={u._id}
                onClick={() => handleSelectUser(u._id)}
                className="w-full p-3 flex items-center gap-3 hover:bg-[#f5f6f6] rounded-xl transition-colors text-left"
              >
                <div className="relative shrink-0">
                  <img
                    src={u.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                    alt={u.username}
                    className="w-10 h-10 rounded-full object-cover border border-gray-200"
                  />
                  {u.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#25d366] border-2 border-white rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm truncate">
                    {u.username}
                  </div>
                  <div className="text-xs text-gray-500 truncate">{u.email}</div>
                </div>
                <UserCheck className="w-4 h-4 text-[#00a884]" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
