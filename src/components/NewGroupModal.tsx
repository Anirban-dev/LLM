import React, { useState, useEffect } from 'react';
import { Users, X, Check, Search } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { User } from '../types';

export const NewGroupModal: React.FC = () => {
  const [groupName, setGroupName] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const { token, isNewGroupOpen, setNewGroupOpen, createGroupChat } = useChatStore();

  useEffect(() => {
    if (isNewGroupOpen && token) {
      fetchUsers();
    }
  }, [isNewGroupOpen, search]);

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

  const toggleSelectUser = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedIds.length === 0) return;

    await createGroupChat(groupName.trim(), selectedIds);
    setGroupName('');
    setSelectedIds([]);
    setNewGroupOpen(false);
  };

  if (!isNewGroupOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="p-4 bg-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <h3 className="font-semibold text-lg">Create Group Chat</h3>
          </div>
          <button
            onClick={() => setNewGroupOpen(false)}
            className="p-1 hover:bg-emerald-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreateGroup} className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Group Name
            </label>
            <input
              type="text"
              placeholder="e.g. Project Team, Weekend Trips"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Select Participants ({selectedIds.length})
            </label>
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search candidates..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {loading ? (
                <div className="p-4 text-center text-xs text-slate-500">Loading users...</div>
              ) : (
                users.map((u) => {
                  const isSelected = selectedIds.includes(u._id);
                  return (
                    <div
                      key={u._id}
                      onClick={() => toggleSelectUser(u._id)}
                      className={`p-2 rounded-lg flex items-center gap-3 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-emerald-500/10 border border-emerald-500/40'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <img
                        src={u.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                        alt={u.username}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {u.username}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">{u.email}</div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={!groupName.trim() || selectedIds.length === 0}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm rounded-xl shadow transition-colors disabled:opacity-50"
          >
            Create Group Chat
          </button>
        </form>
      </div>
    </div>
  );
};
