import React, { useState, useEffect } from 'react';
import {
  X,
  Bot,
  Download,
  Upload,
  Sparkles,
  UserCheck,
  RefreshCw,
  FileCode,
  CheckCircle,
  BrainCircuit,
  Type,
  FileJson,
  Plus,
  Sliders,
  Mic,
  MessageSquare,
  Trash2,
  Edit2,
  Volume2,
} from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PersonaModal: React.FC<PersonaModalProps> = ({ isOpen, onClose }) => {
  const { token, fetchChats, selectChat } = useChatStore();

  const [topTab, setTopTab] = useState<'gallery' | 'editor' | 'clone'>('gallery');
  const [editorSubTab, setEditorSubTab] = useState<'identity' | 'prompt' | 'model' | 'voice'>('identity');

  // Personas List State
  const [personas, setPersonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Persona Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('AI Conversation Partner');
  const [category, setCategory] = useState('Assistant');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful, friendly, and engaging AI persona.');
  const [greetingMessage, setGreetingMessage] = useState('Hello! How can I assist you today?');
  const [model, setModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1000);
  const [voiceId, setVoiceId] = useState('alloy');
  const [speed, setSpeed] = useState(1.0);
  const [autoVoiceReply, setAutoVoiceReply] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  // Extracted Profile & Import state
  const [myPersona, setMyPersona] = useState<any>(null);
  const [importMode, setImportMode] = useState<'text' | 'file'>('text');
  const [directName, setDirectName] = useState('');
  const [directText, setDirectText] = useState('');
  const [importJsonText, setImportJsonText] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (isOpen && token) {
      fetchPersonas();
      fetchMyExtractedPersona();
    }
  }, [isOpen, token]);

  const fetchPersonas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/personas', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPersonas(data);
      }
    } catch (err) {
      console.error('Error fetching personas:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyExtractedPersona = async () => {
    try {
      const res = await fetch('/api/persona/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyPersona(data);
      }
    } catch (err) {
      console.error('Error fetching my extracted persona:', err);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setTagline('AI Conversation Partner');
    setCategory('Assistant');
    setAvatarUrl('');
    setSystemPrompt('You are a helpful, friendly, and engaging AI persona.');
    setGreetingMessage('Hello! How can I assist you today?');
    setModel('gpt-4o');
    setTemperature(0.7);
    setMaxTokens(1000);
    setVoiceId('alloy');
    setSpeed(1.0);
    setAutoVoiceReply(false);
    setIsPublic(true);
  };

  const handleOpenCreateNew = () => {
    resetForm();
    setTopTab('editor');
    setEditorSubTab('identity');
    setError('');
    setSuccessMsg('');
  };

  const handleEditPersona = (p: any) => {
    setEditingId(p._id);
    setName(p.name || '');
    setTagline(p.tagline || 'AI Conversation Partner');
    setCategory(p.category || 'Assistant');
    setAvatarUrl(p.avatarUrl || '');
    setSystemPrompt(p.systemPrompt || 'You are a helpful and friendly AI persona.');
    setGreetingMessage(p.greetingMessage || 'Hello! How can I assist you today?');
    setModel(p.model || 'gpt-4o');
    setTemperature(p.temperature ?? 0.7);
    setMaxTokens(p.maxTokens ?? 1000);
    setVoiceId(p.voiceSettings?.voiceId || 'alloy');
    setSpeed(p.voiceSettings?.speed || 1.0);
    setAutoVoiceReply(p.voiceSettings?.autoVoiceReply || false);
    setIsPublic(p.isPublic !== false);

    setTopTab('editor');
    setEditorSubTab('identity');
    setError('');
    setSuccessMsg('');
  };

  const handleSavePersona = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Persona name is required');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMsg('');

    const payload = {
      name: name.trim(),
      tagline,
      category,
      avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name.trim())}`,
      systemPrompt,
      greetingMessage,
      model,
      temperature,
      maxTokens,
      voiceSettings: {
        voiceId,
        speed,
        autoVoiceReply,
      },
      isPublic,
    };

    try {
      const url = editingId ? `/api/personas/${editingId}` : '/api/personas';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(editingId ? 'Persona updated successfully!' : 'Persona created successfully!');
        await fetchPersonas();
        setTimeout(() => {
          setTopTab('gallery');
        }, 1000);
      } else {
        setError(data.message || 'Error saving persona');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to server');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePersona = async (id: string) => {
    if (!confirm('Are you sure you want to delete this AI persona?')) return;
    try {
      const res = await fetch(`/api/personas/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchPersonas();
      }
    } catch (err) {
      console.error('Delete persona error:', err);
    }
  };

  const handleStartChatWithPersona = async (id: string) => {
    try {
      const res = await fetch(`/api/personas/${id}/chat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.chatId) {
        await fetchChats();
        selectChat(data.chatId);
        onClose();
      }
    } catch (err) {
      console.error('Error starting chat with persona:', err);
    }
  };

  const handleExportMyPersona = () => {
    if (!myPersona) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(myPersona, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `my_persona_${myPersona.name || 'user'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        JSON.parse(content);
        setImportJsonText(content);
        setSuccessMsg('JSON file loaded successfully! Click Import to create Clone Chat.');
      } catch (err) {
        setError('Invalid JSON file format. Please upload a valid my_persona.json file.');
      }
    };
    reader.readAsText(file);
  };

  const handleCreateCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setImporting(true);

    let payload: any = {};
    if (importMode === 'text') {
      if (!directText.trim()) {
        setError('Please write a text description or bio for the persona');
        setImporting(false);
        return;
      }
      payload = { directText: directText.trim(), name: directName.trim() || 'AI Friend' };
    } else {
      if (!importJsonText.trim()) {
        setError('Please paste or upload a valid persona JSON file');
        setImporting(false);
        return;
      }
      try {
        payload = { personaJson: JSON.parse(importJsonText) };
      } catch (err) {
        setError('Invalid JSON syntax');
        setImporting(false);
        return;
      }
    }

    try {
      const res = await fetch('/api/persona/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('AI Clone created successfully!');
        await fetchChats();
        if (data.chatId) {
          selectChat(data.chatId);
          setTimeout(() => onClose(), 1000);
        }
      } else {
        setError(data.message || 'Failed to create persona clone');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating persona clone');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#111b21] text-white p-4 sm:p-5 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00a884]/20 border border-[#00a884]/40 rounded-xl text-[#00a884]">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>AI Persona Engine & Voice Notes</span>
                <span className="text-[10px] bg-[#00a884] text-white px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                  Phase 3
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Custom personalities, streaming responses & server-side TTS voice replies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Level Navigation Tabs */}
        <div className="flex border-b border-gray-200 bg-[#f0f2f5] p-1.5 gap-1.5 px-3 sm:px-5 text-xs font-bold overflow-x-auto">
          <button
            onClick={() => { setTopTab('gallery'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              topTab === 'gallery' ? 'bg-white text-[#00a884] shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Persona Gallery ({personas.length})</span>
          </button>

          <button
            onClick={handleOpenCreateNew}
            className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              topTab === 'editor' ? 'bg-white text-[#00a884] shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{editingId ? 'Edit Persona' : 'Create New AI Persona'}</span>
          </button>

          <button
            onClick={() => { setTopTab('clone'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              topTab === 'clone' ? 'bg-white text-[#00a884] shadow-xs' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Chat Auto-Extractor & Clone</span>
          </button>
        </div>

        {/* Error / Success Notifications */}
        {error && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs font-medium">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TOP TAB 1: PERSONA GALLERY */}
        {topTab === 'gallery' && (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Available AI Personas
              </h3>
              <button
                onClick={handleOpenCreateNew}
                className="px-3 py-1.5 bg-[#00a884] hover:bg-[#008f70] text-white rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Persona</span>
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-gray-500 flex flex-col items-center gap-2">
                <RefreshCw className="w-7 h-7 text-[#00a884] animate-spin" />
                <span className="text-xs">Loading personas...</span>
              </div>
            ) : personas.length === 0 ? (
              <div className="py-12 text-center text-gray-500 space-y-3">
                <Bot className="w-10 h-10 text-gray-300 mx-auto" />
                <p className="text-xs">No custom personas created yet.</p>
                <button
                  onClick={handleOpenCreateNew}
                  className="px-4 py-2 bg-[#00a884] text-white text-xs font-semibold rounded-xl"
                >
                  Create First Persona
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {personas.map((p) => (
                  <div
                    key={p._id}
                    className="p-4 bg-white border border-gray-200 hover:border-[#00a884]/60 rounded-2xl shadow-xs transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={p.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.name)}`}
                        alt={p.name}
                        className="w-11 h-11 rounded-xl bg-gray-100 p-1 border border-gray-200 shrink-0 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-gray-900 truncate">{p.name}</h4>
                          <span className="text-[10px] bg-emerald-50 text-[#00a884] border border-emerald-100 px-2 py-0.5 rounded-full font-medium">
                            {p.category || 'Assistant'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{p.tagline}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                      <span className="flex items-center gap-1 font-mono">
                        <Sliders className="w-3 h-3 text-[#00a884]" />
                        {p.model || 'gpt-4o'}
                      </span>
                      {p.voiceSettings?.autoVoiceReply && (
                        <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                          <Volume2 className="w-3 h-3" />
                          Voice Notes
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => handleStartChatWithPersona(p._id)}
                        className="flex-1 py-2 bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat Now</span>
                      </button>

                      <button
                        onClick={() => handleEditPersona(p)}
                        className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                        title="Edit Persona"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeletePersona(p._id)}
                        className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                        title="Delete Persona"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TOP TAB 2: PERSONA EDITOR (4 SUB TABS) */}
        {topTab === 'editor' && (
          <form onSubmit={handleSavePersona} className="flex-1 flex flex-col overflow-hidden">
            {/* Editor Sub-Tabs Navigation */}
            <div className="flex border-b border-gray-200 bg-gray-50 px-4 sm:px-6 gap-2 pt-2 text-xs font-semibold overflow-x-auto">
              <button
                type="button"
                onClick={() => setEditorSubTab('identity')}
                className={`py-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  editorSubTab === 'identity'
                    ? 'border-[#00a884] text-[#00a884]'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>1. Identity</span>
              </button>

              <button
                type="button"
                onClick={() => setEditorSubTab('prompt')}
                className={`py-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  editorSubTab === 'prompt'
                    ? 'border-[#00a884] text-[#00a884]'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>2. Directives & Greeting</span>
              </button>

              <button
                type="button"
                onClick={() => setEditorSubTab('model')}
                className={`py-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  editorSubTab === 'model'
                    ? 'border-[#00a884] text-[#00a884]'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>3. Model Parameters</span>
              </button>

              <button
                type="button"
                onClick={() => setEditorSubTab('voice')}
                className={`py-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  editorSubTab === 'voice'
                    ? 'border-[#00a884] text-[#00a884]'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>4. Voice Settings</span>
              </button>
            </div>

            {/* Sub-Tab Content Area */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {/* SUB TAB 1: IDENTITY */}
              {editorSubTab === 'identity' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Persona Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Athena AI, Code Architect, Sensei"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#f0f2f5] border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Tagline / Short Bio</label>
                    <input
                      type="text"
                      placeholder="e.g. Master software designer & coding mentor"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f0f2f5] border border-gray-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-[#f0f2f5] border border-gray-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                      >
                        <option value="Assistant">Assistant</option>
                        <option value="Expert">Expert / Consultant</option>
                        <option value="Roleplay">Roleplay / Character</option>
                        <option value="Anime">Anime / Creative</option>
                        <option value="Friend">Virtual Friend / Clone</option>
                        <option value="Custom">Custom</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Avatar Image URL (Optional)</label>
                      <input
                        type="text"
                        placeholder="https://..."
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        className="w-full px-3 py-2 bg-[#f0f2f5] border border-gray-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SUB TAB 2: SYSTEM PROMPT & PERSONALITY */}
              {editorSubTab === 'prompt' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      System Prompt & Detailed Directives
                    </label>
                    <textarea
                      rows={6}
                      placeholder="Define the persona's persona, tone, rules, domain expertise, and behavior..."
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      className="w-full p-3 bg-[#f0f2f5] border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884] leading-relaxed font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Initial Greeting Message</label>
                    <input
                      type="text"
                      placeholder="e.g. Hello! I'm Athena. How can I help you today?"
                      value={greetingMessage}
                      onChange={(e) => setGreetingMessage(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f0f2f5] border border-gray-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                    />
                  </div>
                </div>
              )}

              {/* SUB TAB 3: MODEL PARAMETERS */}
              {editorSubTab === 'model' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">AI Model Backend</label>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f0f2f5] border border-gray-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884] font-mono"
                    >
                      <option value="gpt-4o">gpt-4o (OpenAI Compatible / General)</option>
                      <option value="gpt-4o-mini">gpt-4o-mini (Fast & Lightweight)</option>
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Google GenAI)</option>
                      <option value="llama3.2:3b">llama3.2:3b (Local Ollama / vLLM)</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                      <span>Temperature (Creativity):</span>
                      <span className="font-mono text-[#00a884]">{temperature}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full accent-[#00a884]"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                      <span>Precise / Analytical (0.0)</span>
                      <span>Balanced (0.7)</span>
                      <span>Creative (1.0)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                      <span>Max Response Tokens:</span>
                      <span className="font-mono text-[#00a884]">{maxTokens}</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="4000"
                      step="100"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      className="w-full accent-[#00a884]"
                    />
                  </div>
                </div>
              )}

              {/* SUB TAB 4: VOICE SETTINGS */}
              {editorSubTab === 'voice' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Server-Side TTS Voice</label>
                      <select
                        value={voiceId}
                        onChange={(e) => setVoiceId(e.target.value)}
                        className="w-full px-3 py-2 bg-[#f0f2f5] border border-gray-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                      >
                        <option value="alloy">Alloy (Neutral / Clear)</option>
                        <option value="echo">Echo (Warm / Deep)</option>
                        <option value="fable">Fable (Expressive / Storyteller)</option>
                        <option value="onyx">Onyx (Authoritative Male)</option>
                        <option value="nova">Nova (Friendly Female)</option>
                        <option value="shimmer">Shimmer (Clear Female)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Speech Speed ({speed}x)</label>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={speed}
                        onChange={(e) => setSpeed(parseFloat(e.target.value))}
                        className="w-full accent-[#00a884] mt-2"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                        <Mic className="w-4 h-4 text-[#00a884]" />
                        <span>Auto-Respond with Voice Note</span>
                      </h4>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        Automatically synthesizes server-side playable audio notes for every response
                      </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoVoiceReply}
                        onChange={(e) => setAutoVoiceReply(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00a884]"></div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Form Actions */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setTopTab('gallery')}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-bold rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                <Bot className="w-4 h-4" />
                <span>{saving ? 'Saving Persona...' : editingId ? 'Update Persona' : 'Save & Publish Persona'}</span>
              </button>
            </div>
          </form>
        )}

        {/* TOP TAB 3: AUTO-EXTRACTOR & CLONE ENGINE */}
        {topTab === 'clone' && (
          <form onSubmit={handleCreateCloneSubmit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
            <div className="grid grid-cols-2 bg-[#f0f2f5] p-1 rounded-xl border border-[#e9edef] gap-1">
              <button
                type="button"
                onClick={() => setImportMode('text')}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  importMode === 'text' ? 'bg-[#00a884] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Write Direct Text</span>
              </button>

              <button
                type="button"
                onClick={() => setImportMode('file')}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  importMode === 'file' ? 'bg-[#00a884] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Use my_persona.json File</span>
              </button>
            </div>

            {importMode === 'text' ? (
              <div className="space-y-4">
                <p className="text-xs text-gray-600">
                  Type a plain text description of a friend. Our AI engine parses their bio, tone, and habits to build a custom clone!
                </p>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Friend's Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah, Marcus, or Mentor"
                    value={directName}
                    onChange={(e) => setDirectName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#f0f2f5] border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Direct Text Description (Bio, Tone, Habits, Stances)
                  </label>
                  <textarea
                    rows={5}
                    placeholder="e.g. Sarah is a UX designer who loves matcha, climbing, and open source. She speaks enthusiastically with exclamation marks and emojis."
                    value={directText}
                    onChange={(e) => setDirectText(e.target.value)}
                    className="w-full p-3 bg-[#f0f2f5] border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-600">
                  Upload or paste a friend's <code className="font-mono text-[#00a884]">my_persona.json</code> file!
                </p>

                <div className="border-2 border-dashed border-gray-300 hover:border-[#00a884] rounded-2xl p-6 text-center transition-colors bg-[#f0f2f5]/50 relative">
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FileCode className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-gray-700">Click or drag to upload my_persona.json file</p>
                </div>

                <div>
                  <textarea
                    rows={5}
                    placeholder='{"name": "Alex", "bio": { "occupation": "Developer" }}'
                    value={importJsonText}
                    onChange={(e) => setImportJsonText(e.target.value)}
                    className="w-full p-3 bg-[#f0f2f5] border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={importing}
              className="w-full py-3 bg-[#00a884] hover:bg-[#008f70] text-white font-semibold text-sm rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Bot className="w-4 h-4" />
              <span>{importing ? 'Processing AI Clone...' : 'Create AI Clone Chat'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
