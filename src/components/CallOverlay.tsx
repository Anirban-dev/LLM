import React, { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, User as UserIcon } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

export const CallOverlay: React.FC = () => {
  const {
    callStatus,
    incomingCaller,
    activeCallPeer,
    remoteStream,
    isMuted,
    isSpeakerOn,
    callDuration,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleSpeaker,
  } = useChatStore();

  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Assign remote audio stream when available
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch((e) => console.error('Audio play error:', e));
    }
  }, [remoteStream]);

  if (callStatus === 'idle') return null;

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 1. Incoming Call Modal / Banner
  if (callStatus === 'incoming' && incomingCaller) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center border border-gray-100">
          <div className="relative mx-auto w-24 h-24 mb-4">
            <div className="absolute inset-0 rounded-full bg-[#00a884]/20 animate-ping"></div>
            {incomingCaller.avatarUrl ? (
              <img
                src={incomingCaller.avatarUrl}
                alt={incomingCaller.username}
                className="w-24 h-24 rounded-full object-cover relative z-10 border-2 border-[#00a884]"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-[#f0f2f5] flex items-center justify-center relative z-10 border-2 border-[#00a884]">
                <UserIcon className="w-12 h-12 text-gray-500" />
              </div>
            )}
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-1">{incomingCaller.username}</h3>
          <p className="text-sm font-medium text-[#00a884] mb-8">Incoming Voice Call...</p>

          <div className="flex items-center justify-around gap-4">
            <button
              onClick={declineCall}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 text-white font-medium shadow-md transition-all"
            >
              <PhoneOff className="w-5 h-5" />
              Decline
            </button>
            <button
              onClick={acceptCall}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#00a884] hover:bg-[#008f70] active:scale-95 text-white font-medium shadow-md transition-all"
            >
              <Phone className="w-5 h-5" />
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Active Call Screen / Overlay (Calling or Connected)
  const currentPeer = activeCallPeer || incomingCaller;

  return (
    <div className="fixed inset-x-4 top-4 md:inset-auto md:top-6 md:right-6 z-50 animate-slide-down">
      <audio ref={remoteAudioRef} autoPlay muted={!isSpeakerOn} />

      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl p-4 md:p-5 w-full md:w-80 border border-gray-800 flex flex-col items-center">
        <div className="flex items-center gap-3 w-full mb-4">
          {currentPeer?.avatarUrl ? (
            <img
              src={currentPeer.avatarUrl}
              alt={currentPeer.username}
              className="w-12 h-12 rounded-full object-cover border border-[#00a884]"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center border border-[#00a884]">
              <UserIcon className="w-6 h-6 text-gray-300" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-base truncate text-gray-100">{currentPeer?.username}</h4>
            <p className="text-xs text-[#25d366] font-medium">
              {callStatus === 'calling' ? (
                <span className="animate-pulse">Calling...</span>
              ) : (
                `Connected • ${formatTimer(callDuration)}`
              )}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 w-full pt-2 border-t border-gray-800">
          <button
            onClick={toggleMute}
            className={`p-3 rounded-full transition-all ${
              isMuted
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
            }`}
            title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleSpeaker}
            className={`p-3 rounded-full transition-all ${
              !isSpeakerOn
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
            }`}
            title={isSpeakerOn ? 'Mute Speaker' : 'Enable Speaker'}
          >
            {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>

          <button
            onClick={endCall}
            className="p-3 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white shadow-lg transition-all"
            title="Hang Up"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
