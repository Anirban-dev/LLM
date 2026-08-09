import React from 'react';
import { Bot, Plus, Edit2, Download, MessageSquare } from 'lucide-react';

interface PersonaListTabProps {
  myPersona: any;
  communityPersonas: any[];
  onSelectEdit: (persona: any) => void;
  onExport: (personaId: string, name: string) => void;
  onStartChat: (personaId: string) => void;
  onCreateNew: () => void;
}

export const PersonaListTab: React.FC<PersonaListTabProps> = ({
  myPersona,
  communityPersonas,
  onSelectEdit,
  onExport,
  onStartChat,
  onCreateNew,
}) => {
  return (
    <div className="space-y-6">
      {/* My Main Persona Profile Card */}
      <div className="bg-[#f0f2f5] p-4 rounded-xl border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#00a884]/10 rounded-full flex items-center justify-center text-[#00a884]">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">{myPersona?.name || 'My AI Persona'}</h3>
              <p className="text-xs text-gray-500">
                {myPersona?.bio?.occupation || 'Personal AI Replica'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onSelectEdit(myPersona)}
              className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
              title="Edit Persona"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {myPersona?._id && (
              <button
                onClick={() => onExport(myPersona._id, myPersona.name)}
                className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
                title="Export JSON"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {myPersona?.bio?.facts && myPersona.bio.facts.length > 0 && (
          <div className="mt-2 text-xs text-gray-600 bg-white p-2.5 rounded-lg border border-gray-200/80">
            <span className="font-semibold text-gray-700 block mb-1">Key Traits & Facts:</span>
            <ul className="list-disc list-inside space-y-0.5">
              {myPersona.bio.facts.slice(0, 3).map((f: string, i: number) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Community & Public Personas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Explore AI Personas
          </h4>
          <button
            onClick={onCreateNew}
            className="text-xs text-[#00a884] font-semibold flex items-center gap-1 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Custom</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {communityPersonas.map((p) => (
            <div
              key={p._id}
              className="p-3.5 bg-white border border-gray-200 rounded-xl hover:border-[#00a884] transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-[#00a884] text-xs font-bold">
                    {p.name.charAt(0)}
                  </div>
                  <div>
                    <h5 className="font-semibold text-xs text-gray-900">{p.name}</h5>
                    <p className="text-[10px] text-gray-500">{p.bio?.occupation || 'AI Companion'}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-600 line-clamp-2 mb-3">
                  {p.systemPrompt || 'An AI persona ready to chat with you.'}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => onStartChat(p._id)}
                  className="flex-1 py-1.5 bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Chat</span>
                </button>
                <button
                  onClick={() => onExport(p._id, p.name)}
                  className="p-1.5 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-lg"
                  title="Export Persona"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
