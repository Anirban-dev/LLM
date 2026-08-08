import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Play, Pause } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

interface AudioRecorderProps {
  onClose: () => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onClose }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const { token, sendMessage } = useChatStore();

  useEffect(() => {
    startRecording();
    return () => {
      stopTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startTimer = () => {
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Stop media tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      startTimer();
    } catch (err) {
      console.error('Microphone access error:', err);
      alert('Could not access microphone. Please check browser permissions.');
      onClose();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();
    }
  };

  const cancelRecording = () => {
    stopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setAudioBlob(null);
    setAudioUrl(null);
    onClose();
  };

  const togglePreview = () => {
    if (!previewAudioRef.current) return;
    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play();
      setIsPlayingPreview(true);
    }
  };

  const handleSendAudio = async () => {
    if (!audioBlob || !token) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice-note.webm');
      formData.append('duration', recordingTime.toString());

      const res = await fetch('/api/messages/upload-audio', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        await sendMessage('🎤 Voice Note', data.mediaUrl, recordingTime);
        onClose();
      } else {
        alert('Failed to upload audio recording');
      }
    } catch (err) {
      console.error('Send audio error:', err);
      alert('Error uploading audio recording');
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  return (
    <div className="flex items-center gap-3 w-full bg-slate-100 dark:bg-slate-800 px-4 py-2.5 rounded-full shadow-inner border border-emerald-500/30">
      {audioUrl && <audio ref={previewAudioRef} src={audioUrl} onEnded={() => setIsPlayingPreview(false)} />}

      <button
        type="button"
        onClick={cancelRecording}
        className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors"
        title="Cancel"
      >
        <Trash2 className="w-5 h-5" />
      </button>

      {/* Recording indicator & timer */}
      <div className="flex-1 flex items-center gap-3">
        {isRecording ? (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-rose-500 rounded-full animate-ping shrink-0" />
            <span className="text-sm font-semibold text-rose-600 dark:text-rose-400 font-mono">
              Recording {formatTime(recordingTime)}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePreview}
              className="p-1.5 bg-emerald-600 text-white rounded-full hover:bg-emerald-500"
            >
              {isPlayingPreview ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <span className="text-xs text-slate-600 dark:text-slate-300 font-mono">
              Audio Note ({formatTime(recordingTime)})
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {isRecording ? (
        <button
          type="button"
          onClick={stopRecording}
          className="p-2 bg-rose-600 hover:bg-rose-500 text-white rounded-full shadow transition-transform active:scale-95"
          title="Stop Recording"
        >
          <Square className="w-5 h-5 fill-current" />
        </button>
      ) : (
        <button
          type="button"
          disabled={isUploading}
          onClick={handleSendAudio}
          className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow transition-transform active:scale-95 disabled:opacity-50"
          title="Send Voice Note"
        >
          {isUploading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      )}
    </div>
  );
};
