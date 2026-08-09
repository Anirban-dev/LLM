import React from 'react';
import { Volume2, Check, CheckCheck, FileText, Image as ImageIcon } from 'lucide-react';
import { Message } from '../../types';
import { AudioPlayer } from '../AudioPlayer';

interface ChatMessageItemProps {
  message: Message;
  isOwn: boolean;
  onSpeak: (text: string) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, isOwn, onSpeak }) => {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-3`}>
      <div
        className={`max-w-[85%] sm:max-w-[70%] p-3 rounded-2xl shadow-sm relative group ${
          isOwn
            ? 'bg-[#d9fdd3] text-gray-900 rounded-tr-none'
            : 'bg-white text-gray-900 rounded-tl-none border border-gray-100'
        }`}
      >
        {/* Sender Label for Group or Persona */}
        {!isOwn && message.senderId?.username && (
          <span className="text-[11px] font-bold text-[#00a884] block mb-1">
            {message.senderId.username}
          </span>
        )}

        {/* Media Attachments */}
        {message.type === 'image' && message.mediaUrl && (
          <div className="mb-2 overflow-hidden rounded-xl">
            <img src={message.mediaUrl} alt={message.fileName || 'Attachment'} className="max-h-60 w-auto object-cover rounded-xl" />
          </div>
        )}

        {message.type === 'document' && message.mediaUrl && (
          <a
            href={message.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-xl mb-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <FileText className="w-4 h-4 text-[#00a884]" />
            <span className="truncate">{message.fileName || 'Download Attachment'}</span>
          </a>
        )}

        {message.type === 'audio' && message.mediaUrl ? (
          <AudioPlayer audioUrl={message.mediaUrl} duration={message.duration} isOwn={isOwn} />
        ) : (
          message.content && <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        )}

        {/* Footer: Time + Voice TTS Speak Button + Delivery Checkmarks */}
        <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] text-gray-500">
          {message.content && (
            <button
              onClick={() => onSpeak(message.content)}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-[#00a884] transition-opacity"
              title="Speak message"
            >
              <Volume2 className="w-3 h-3" />
            </button>
          )}
          <span>{time}</span>
          {isOwn && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
        </div>
      </div>
    </div>
  );
};
