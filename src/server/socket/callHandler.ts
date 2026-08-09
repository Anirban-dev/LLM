import { Server as SocketIOServer, Socket } from 'socket.io';
import { User } from '../models/User';
import { SocketUser, UserSocketsMap } from './types';

export function registerCallHandler(
  io: SocketIOServer,
  socket: Socket,
  userSocketsMap: UserSocketsMap
): void {
  const user = socket.data.user as SocketUser;
  const userId = user.id;

  // Initiate Call
  socket.on('call_user', async (data: { recipientId: string; offer: any }) => {
    const { recipientId, offer } = data;
    const callerInfo = await User.findById(userId).select('-passwordHash');
    const targetSockets = userSocketsMap.get(recipientId);

    if (targetSockets && targetSockets.size > 0) {
      targetSockets.forEach((sId) => {
        io.to(sId).emit('incoming_call', {
          callerId: userId,
          caller: callerInfo,
          offer,
        });
      });
    } else {
      socket.emit('call_failed', { reason: 'User is offline' });
    }
  });

  // Accept Call
  socket.on('call_accepted', (data: { callerId: string; answer: any }) => {
    const { callerId, answer } = data;
    const callerSockets = userSocketsMap.get(callerId);
    if (callerSockets) {
      callerSockets.forEach((sId) => {
        io.to(sId).emit('call_accepted', { answer, acceptorId: userId });
      });
    }
  });

  // Decline Call
  socket.on('call_declined', (data: { callerId: string }) => {
    const { callerId } = data;
    const callerSockets = userSocketsMap.get(callerId);
    if (callerSockets) {
      callerSockets.forEach((sId) => {
        io.to(sId).emit('call_declined', { declinerId: userId, username: user.username });
      });
    }
  });

  // ICE Candidate
  socket.on('ice_candidate', (data: { targetId: string; candidate: any }) => {
    const { targetId, candidate } = data;
    const targetSockets = userSocketsMap.get(targetId);
    if (targetSockets) {
      targetSockets.forEach((sId) => {
        io.to(sId).emit('ice_candidate', { senderId: userId, candidate });
      });
    }
  });

  // End Call
  socket.on('end_call', (data: { targetId: string }) => {
    const { targetId } = data;
    if (targetId) {
      const targetSockets = userSocketsMap.get(targetId);
      if (targetSockets) {
        targetSockets.forEach((sId) => io.to(sId).emit('call_ended', { senderId: userId }));
      }
    }
  });
}
