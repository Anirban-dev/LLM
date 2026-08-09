import { StateCreator } from 'zustand';
import { User, CallStatus } from '../../types';

export interface CallSlice {
  callStatus: CallStatus;
  incomingCaller: User | null;
  activeCallPeer: User | null;
  pendingOffer: any | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  callDuration: number;

  setCallStatus: (status: CallStatus) => void;
  setIncomingCall: (caller: User | null, offer: any) => void;
  setCallActive: (peer: User) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  resetCall: () => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
}

export const createCallSlice: StateCreator<CallSlice> = (set) => ({
  callStatus: 'idle',
  incomingCaller: null,
  activeCallPeer: null,
  pendingOffer: null,
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isSpeakerOn: true,
  callDuration: 0,

  setCallStatus: (status) => set({ callStatus: status }),
  setIncomingCall: (caller, offer) =>
    set({ incomingCaller: caller, pendingOffer: offer, callStatus: caller ? 'incoming' : 'idle' }),
  setCallActive: (peer) => set({ activeCallPeer: peer, callStatus: 'connected' }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setRemoteStream: (stream) => set({ remoteStream: stream }),
  resetCall: () =>
    set({
      callStatus: 'idle',
      incomingCaller: null,
      activeCallPeer: null,
      pendingOffer: null,
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isSpeakerOn: true,
      callDuration: 0,
    }),
  acceptCall: () => set((state) => ({ callStatus: 'connected', activeCallPeer: state.incomingCaller })),
  declineCall: () => set({ callStatus: 'idle', incomingCaller: null, pendingOffer: null }),
  endCall: () => set({ callStatus: 'idle', activeCallPeer: null, incomingCaller: null, localStream: null, remoteStream: null }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  toggleSpeaker: () => set((state) => ({ isSpeakerOn: !state.isSpeakerOn })),
});
