import React, { useState, useEffect } from 'react';
import { X, Bot, Sparkles } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { PersonaListTab } from './persona/PersonaListTab';
import { PersonaEditForm } from './persona/PersonaEditForm';
import { PersonaCloneImporter } from './persona/PersonaCloneImporter';

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PersonaModal: React.FC<PersonaModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'list' | 'edit' | 'import'>('list');
  const [myPersona, setMyPersona] = useState<any>(null);
  const [communityPersonas, setCommunityPersonas] = useState<any[]>([]);
  const [editingPersona, setEditingPersona] = useState<any>(null);

  const { selectChat } = useChatStore();

  const fetchPersonas = async () => {
    try {
      const token = localStorage.getItem('chat_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [meRes, commRes] = await Promise.all([
        fetch('/api/persona/me', { headers }),
        fetch('/api/persona/community', { headers }),
      ]);

      if (meRes.ok) setMyPersona(await meRes.json());
      if (commRes.ok) setCommunityPersonas(await commRes.json());
    } catch (err) {
      console.error('Error fetching personas:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPersonas();
      setActiveTab('list');
    }
  }, [isOpen]);

  const handleSavePersona = async (updatedData: any) => {
    try {
      const token = localStorage.getItem('chat_token');
      const res = await fetch('/api/persona/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updatedData),
      });

      if (res.ok) {
        await fetchPersonas();
        setActiveTab('list');
      }
    } catch (err) {
      console.error('Error saving persona:', err);
    }
  };

  const handleExportPersona = (personaId: string, name: string) => {
    const token = localStorage.getItem('chat_token');
    window.open(`/api/persona/export-json/${personaId}?token=${token}`, '_blank');
  };

  const handleStartChatWithPersona = async (personaId: string) => {
    try {
      const token = localStorage.getItem('chat_token');
      const res = await fetch('/api/persona/chat-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ personaId }),
      });

      if (res.ok) {
        const chat = await res.json();
        selectChat(chat._id);
        onClose();
      }
    } catch (err) {
      console.error('Error starting chat with persona:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#f0f2f5] border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#00a884]" />
            <h2 className="font-bold text-gray-900 text-sm">AI Personas & Clones</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-full text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Sub-Header Tabs */}
        <div className="px-6 pt-3 bg-white border-b border-gray-100 flex gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('list')}
            className={`pb-2.5 transition-colors border-b-2 ${
              activeTab === 'list' ? 'border-[#00a884] text-[#00a884]' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Personas
          </button>
          <button
            onClick={() => { setEditingPersona(myPersona); setActiveTab('edit'); }}
            className={`pb-2.5 transition-colors border-b-2 ${
              activeTab === 'edit' ? 'border-[#00a884] text-[#00a884]' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Edit Profile
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1 ${
              activeTab === 'import' ? 'border-[#00a884] text-[#00a884]' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Import / Synthesize</span>
          </button>
        </div>

        {/* Modal Content Area */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'list' && (
            <PersonaListTab
              myPersona={myPersona}
              communityPersonas={communityPersonas}
              onSelectEdit={(p) => { setEditingPersona(p); setActiveTab('edit'); }}
              onExport={handleExportPersona}
              onStartChat={handleStartChatWithPersona}
              onCreateNew={() => { setEditingPersona(null); setActiveTab('edit'); }}
            />
          )}

          {activeTab === 'edit' && (
            <PersonaEditForm
              initialPersona={editingPersona}
              onSave={handleSavePersona}
              onCancel={() => setActiveTab('list')}
            />
          )}

          {activeTab === 'import' && (
            <PersonaCloneImporter
              onImportDone={() => { fetchPersonas(); setActiveTab('list'); }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
