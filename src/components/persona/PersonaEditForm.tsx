import React, { useState } from 'react';
import { Save, Bot } from 'lucide-react';

interface PersonaEditFormProps {
  initialPersona: any;
  onSave: (updatedData: any) => Promise<void>;
  onCancel: () => void;
}

export const PersonaEditForm: React.FC<PersonaEditFormProps> = ({
  initialPersona,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(initialPersona?.name || '');
  const [systemPrompt, setSystemPrompt] = useState(initialPersona?.systemPrompt || '');
  const [occupation, setOccupation] = useState(initialPersona?.bio?.occupation || '');
  const [tone, setTone] = useState(initialPersona?.style?.tone || 'friendly');
  const [voiceId, setVoiceId] = useState(initialPersona?.voiceSettings?.voiceId || 'alloy');
  const [autoVoiceReply, setAutoVoiceReply] = useState(
    initialPersona?.voiceSettings?.autoVoiceReply || false
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSave({
        name,
        systemPrompt,
        bio: { occupation },
        style: { tone },
        voiceSettings: { voiceId, speed: 1.0, autoVoiceReply },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
        <div className="w-10 h-10 bg-[#00a884]/10 rounded-full flex items-center justify-center text-[#00a884]">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-sm">
            {initialPersona?._id ? 'Edit Persona Profile' : 'Create New Persona'}
          </h3>
          <p className="text-xs text-gray-500">Customize AI personality & response behavior</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Persona Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 bg-[#f0f2f5] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884]"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Role / Occupation</label>
        <input
          type="text"
          value={occupation}
          onChange={(e) => setOccupation(e.target.value)}
          className="w-full px-3 py-2 bg-[#f0f2f5] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#00a884]"
          placeholder="e.g. Mentor, Assistant, Friend"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">System Instructions</label>
        <textarea
          rows={3}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="w-full px-3 py-2 bg-[#f0f2f5] border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#00a884]"
          placeholder="Describe how this persona should talk and behave..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Tone of Voice</label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full px-3 py-2 bg-[#f0f2f5] border border-gray-200 rounded-xl text-xs"
          >
            <option value="friendly">Friendly & Casual</option>
            <option value="professional">Professional & Direct</option>
            <option value="witty">Witty & Humorous</option>
            <option value="empathetic">Empathetic & Caring</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Voice Accent</label>
          <select
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            className="w-full px-3 py-2 bg-[#f0f2f5] border border-gray-200 rounded-xl text-xs"
          >
            <option value="alloy">Alloy (Neutral)</option>
            <option value="echo">Echo (Deep Male)</option>
            <option value="nova">Nova (Bright Female)</option>
            <option value="shimmer">Shimmer (Soft Female)</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <input
          type="checkbox"
          id="autoVoice"
          checked={autoVoiceReply}
          onChange={(e) => setAutoVoiceReply(e.target.checked)}
          className="rounded border-gray-300 text-[#00a884] focus:ring-[#00a884]"
        />
        <label htmlFor="autoVoice" className="text-xs text-gray-700 font-medium">
          Auto-generate voice audio note for every reply
        </label>
      </div>

      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2.5 bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{loading ? 'Saving...' : 'Save Persona'}</span>
        </button>
      </div>
    </form>
  );
};
