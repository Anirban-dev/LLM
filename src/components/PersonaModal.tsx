import React, { useState, useEffect } from 'react';
import { X, Bot, Download, Upload, Sparkles, UserCheck, RefreshCw, FileCode, CheckCircle, BrainCircuit, Type, FileJson } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PersonaModal: React.FC<PersonaModalProps> = ({ isOpen, onClose }) => {
  const { token, fetchChats, selectChat } = useChatStore();
  const [activeTab, setActiveTab] = useState<'view' | 'import'>('view');

  const [persona, setPersona] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Import / Creation state
  const [importMode, setImportMode] = useState<'text' | 'file'>('text');
  const [directName, setDirectName] = useState('');
  const [directText, setDirectText] = useState('');
  const [importJsonText, setImportJsonText] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (isOpen && token) {
      fetchMyPersona();
    }
  }, [isOpen, token]);

  const fetchMyPersona = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/persona/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPersona(data);
      } else {
        setError('Failed to load persona details');
      }
    } catch (err: any) {
      setError('Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!persona) return;
    const personaData = {
      name: persona.name,
      bio: persona.bio,
      style: persona.style,
      stances: persona.stances || [],
      exportedAt: new Date().toISOString(),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(personaData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `my_persona_${persona.name || 'user'}.json`);
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
        // Validate JSON syntax
        JSON.parse(content);
        setImportJsonText(content);
        setSuccessMsg('JSON file loaded successfully! Click Import to create Clone Chat.');
      } catch (err) {
        setError('Invalid JSON file format. Please upload a valid my_persona.json file.');
      }
    };
    reader.readAsText(file);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
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
        setError('Invalid JSON payload. Please ensure valid JSON syntax.');
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
        const cloneName = data.persona?.name || directName || 'AI Agent';
        setSuccessMsg(`AI Clone chat with ${cloneName} created successfully!`);
        await fetchChats();
        if (data.chatId) {
          selectChat(data.chatId);
          setTimeout(() => {
            onClose();
          }, 1200);
        }
      } else {
        setError(data.message || 'Failed to create persona clone');
      }
    } catch (err: any) {
      setError(err.message || 'Server error creating persona clone');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#111b21] text-white p-5 flex items-center justify-between border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00a884]/20 border border-[#00a884]/40 rounded-xl text-[#00a884]">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>AI Persona Extractor & Clone Engine</span>
                <span className="text-[10px] bg-[#00a884] text-white px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                  Ollama CPU
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Auto-extracts habits into <code className="text-[#00a884] font-mono">my_persona.json</code> or creates custom clones
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

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-200 bg-[#f0f2f5] p-1.5 gap-2 px-5">
          <button
            onClick={() => { setActiveTab('view'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'view' ? 'bg-white text-[#00a884] shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>My Extracted Profile</span>
          </button>
          <button
            onClick={() => { setActiveTab('import'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'import' ? 'bg-white text-[#00a884] shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Create / Import Persona</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs font-medium">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-medium flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab 1: My Extracted Profile */}
        {activeTab === 'view' && (
          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            {loading ? (
              <div className="py-12 text-center text-gray-500 flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 text-[#00a884] animate-spin" />
                <p className="text-xs font-medium">Analyzing background chat messages & loading persona profile...</p>
              </div>
            ) : persona ? (
              <>
                <div className="bg-[#f0f2f5] border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(persona.name || 'User')}`}
                      alt="Persona Avatar"
                      className="w-12 h-12 rounded-2xl bg-white border border-gray-200 p-1"
                    />
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{persona.name}'s AI Persona</h3>
                      <p className="text-xs text-gray-500">
                        Auto-updates on CPU as you send chat messages
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleExport}
                    className="px-4 py-2 bg-[#00a884] hover:bg-[#008f70] text-white font-semibold text-xs rounded-xl shadow-sm transition-transform active:scale-95 flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export my_persona.json</span>
                  </button>
                </div>

                {/* Profile Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bio & Knowledge */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2 text-[#00a884]">
                      <UserCheck className="w-4 h-4" />
                      <span>Background & Facts</span>
                    </h4>

                    <div className="text-xs space-y-2">
                      <div>
                        <span className="text-gray-500 block">Occupation:</span>
                        <span className="font-semibold text-gray-800">
                          {persona.bio?.occupation || 'Learning from your messages...'}
                        </span>
                      </div>

                      <div>
                        <span className="text-gray-500 block">Hobbies:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {persona.bio?.hobbies?.length > 0 ? (
                            persona.bio.hobbies.map((h: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-md font-medium">
                                {h}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 italic">None detected yet</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-gray-500 block">Extracted Personal Facts:</span>
                        <ul className="list-disc list-inside text-gray-700 mt-1 space-y-1">
                          {persona.bio?.facts?.length > 0 ? (
                            persona.bio.facts.map((f: string, i: number) => <li key={i}>{f}</li>)
                          ) : (
                            <li className="text-gray-400 italic">Chat more to automatically extract facts!</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Communication Style */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2 text-[#00a884]">
                      <Sparkles className="w-4 h-4" />
                      <span>Tone & Communication Style</span>
                    </h4>

                    <div className="text-xs space-y-2">
                      <div>
                        <span className="text-gray-500 block">Tone:</span>
                        <span className="font-semibold text-gray-800">{persona.style?.tone || 'Casual'}</span>
                      </div>

                      <div>
                        <span className="text-gray-500 block">Punctuation & Syntax:</span>
                        <span className="font-semibold text-gray-800">{persona.style?.punctuation || 'Standard'}</span>
                      </div>

                      <div>
                        <span className="text-gray-500 block">Frequent Phrases:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {persona.style?.frequently_used_phrases?.length > 0 ? (
                            persona.style.frequently_used_phrases.map((p: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-emerald-50 text-[#00a884] rounded-md font-medium border border-emerald-100">
                                "{p}"
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 italic">None detected yet</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="text-gray-500 block">Emoji Style:</span>
                        <span className="font-semibold text-gray-800">{persona.style?.emoji_usage || 'Occasional'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stances & Opinions */}
                <div className="bg-white border border-gray-200 rounded-2xl p-4">
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2 text-[#00a884]">
                    Core Stances & Opinions
                  </h4>
                  {persona.stances?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {persona.stances.map((stance: string, idx: number) => (
                        <span key={idx} className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium">
                          {stance}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No specific stances detected yet.</p>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Tab 2: Create / Import Friend's Persona */}
        {activeTab === 'import' && (
          <form onSubmit={handleCreateSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
            {/* Input Method Selector */}
            <div className="grid grid-cols-2 bg-[#f0f2f5] p-1 rounded-xl border border-[#e9edef] gap-1">
              <button
                type="button"
                onClick={() => setImportMode('text')}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  importMode === 'text' ? 'bg-[#00a884] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span>Write Direct Text</span>
              </button>

              <button
                type="button"
                onClick={() => setImportMode('file')}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  importMode === 'file' ? 'bg-[#00a884] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileJson className="w-3.5 h-3.5" />
                <span>Use my_persona.json File</span>
              </button>
            </div>

            {/* MODE 1: DIRECT TEXT INPUT */}
            {importMode === 'text' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-600">
                  Type a plain text description of a friend or persona. Our local AI model will parse their bio, tone, and habits to build their clone agent!
                </p>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Persona / Friend's Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Sarah, Marcus, or Mentor"
                    value={directName}
                    onChange={(e) => setDirectName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#f0f2f5] border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Direct Text Description (Bio, Tone, Habits, Opinions)
                  </label>
                  <textarea
                    rows={6}
                    placeholder="e.g. Sarah is a 27-year-old UX designer in San Francisco. She loves specialty matcha, rock climbing, and open source. She speaks enthusiastically with exclamation marks, types mostly in lowercase, and frequently uses emojis like ☕✨. Main stance: prefers clean minimal design over heavy gradients."
                    value={directText}
                    onChange={(e) => setDirectText(e.target.value)}
                    className="w-full p-3 bg-[#f0f2f5] border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884] leading-relaxed"
                    required
                  />
                </div>
              </div>
            )}

            {/* MODE 2: EXPORTED JSON FILE INPUT */}
            {importMode === 'file' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-600">
                  Upload or paste a friend's <code className="font-mono text-[#00a884]">my_persona.json</code> file exported from their app!
                </p>

                {/* File Upload Dropzone */}
                <div className="border-2 border-dashed border-gray-300 hover:border-[#00a884] rounded-2xl p-6 text-center transition-colors bg-[#f0f2f5]/50 relative">
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <FileCode className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-gray-700">Click or drag to upload exported my_persona.json file</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Or paste the JSON payload manually below</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Raw JSON Payload</label>
                  <textarea
                    rows={6}
                    placeholder='{"name": "Alex", "bio": { "occupation": "Developer", "hobbies": ["coffee"] }, "style": { "tone": "humorous" }}'
                    value={importJsonText}
                    onChange={(e) => setImportJsonText(e.target.value)}
                    className="w-full p-3 bg-[#f0f2f5] border border-gray-200 rounded-xl text-xs font-mono text-gray-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
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
              <span>{importing ? 'Processing & Creating AI Clone...' : 'Create AI Clone Chat'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
