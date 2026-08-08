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
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5" />
            <h3 className="font-semibold text-lg">New Direct Chat</h3>
          </div>
          <button
            onClick={() => setNewChatOpen(false)}
            className="p-1 hover:bg-emerald-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No users found</div>
          ) : (
            users.map((u) => (
              <button
                key={u._id}
                onClick={() => handleSelectUser(u._id)}
                className="w-full p-3 flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-xl transition-colors text-left"
              >
                <div className="relative shrink-0">
                  <img
                    src={u.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                    alt={u.username}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-600"
                  />
                  {u.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">
                    {u.username}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}</div>
                </div>
                <UserCheck className="w-4 h-4 text-emerald-600 opacity-0 group-hover:opacity-100" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
