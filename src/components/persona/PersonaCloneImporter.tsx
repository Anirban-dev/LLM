import React, { useState } from 'react';
import { Upload, Sparkles, FileCode } from 'lucide-react';

interface PersonaCloneImporterProps {
  onImportDone: (personaData: any) => void;
}

export const PersonaCloneImporter: React.FC<PersonaCloneImporterProps> = ({
  onImportDone,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'text' | 'json'>('text');
  const [rawText, setRawText] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExtractText = async () => {
    if (!rawText.trim()) return;
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('chat_token');
      const res = await fetch('/api/persona/extract-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rawText }),
      });

      const data = await res.json();
      if (res.ok) {
        onImportDone(data);
      } else {
        setError(data.message || 'Failed to extract persona');
      }
    } catch (err: any) {
      setError(err.message || 'Extraction error');
    } finally {
      setLoading(false);
    }
  };

  const handleImportJson = async () => {
    if (!jsonText.trim()) return;
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('chat_token');
      const res = await fetch('/api/persona/import-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jsonContent: jsonText }),
      });

      const data = await res.json();
      if (res.ok) {
        onImportDone(data);
      } else {
        setError(data.message || 'Failed to import JSON persona');
      }
    } catch (err: any) {
      setError(err.message || 'JSON import error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub tabs */}
      <div className="flex bg-[#f0f2f5] p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveSubTab('text')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
            activeSubTab === 'text' ? 'bg-[#00a884] text-white shadow-sm' : 'text-gray-600'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>From Text / Description</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('json')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
            activeSubTab === 'json' ? 'bg-[#00a884] text-white shadow-sm' : 'text-gray-600'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          <span>From JSON File</span>
        </button>
      </div>

      {error && (
        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl">
          {error}
        </div>
      )}

      {activeSubTab === 'text' ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Paste bio text, chat snippets, or background info to auto-synthesize an AI Persona.
          </p>
          <textarea
            rows={5}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="w-full p-3 bg-[#f0f2f5] border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#00a884]"
            placeholder="Paste text description here..."
          />
          <button
            onClick={handleExtractText}
            disabled={loading || !rawText.trim()}
            className="w-full py-2.5 bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{loading ? 'Synthesizing Persona...' : 'Synthesize Persona Profile'}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Paste raw JSON exported from another AI Persona profile.</p>
          <textarea
            rows={5}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="w-full p-3 bg-[#f0f2f5] border border-gray-200 rounded-xl font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#00a884]"
            placeholder='{"persona": {"name": "Assistant", ...}}'
          />
          <button
            onClick={handleImportJson}
            disabled={loading || !jsonText.trim()}
            className="w-full py-2.5 bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{loading ? 'Importing...' : 'Import JSON Persona'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
