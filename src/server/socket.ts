import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyToken } from './auth';
import { User } from './models/User';
import { SocketUser, UserSocketsMap } from './socket/types';
import { registerMessageHandler } from './socket/messageHandler';
import { registerCallHandler } from './socket/callHandler';

const userSocketsMap: UserSocketsMap = new Map();

export function initializeSocketIO(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // JWT Socket Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) return next(new Error('Authentication error: No token provided'));

      const decoded = verifyToken(token) as SocketUser;
      if (!decoded || !decoded.id) return next(new Error('Authentication error: Invalid token'));

      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Unauthorized'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    const userId = user.id;

    if (!userSocketsMap.has(userId)) {
      userSocketsMap.set(userId, new Set());
    }
    userSocketsMap.get(userId)!.add(socket.id);

    try {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      io.emit('user_status_change', { userId, isOnline: true, lastSeen: new Date().toISOString() });
    } catch (error) {
      console.error('Error updating online status:', error);
    }

    socket.on('join_chat', (chatId: string) => chatId && socket.join(`chat:${chatId}`));
    socket.on('leave_chat', (chatId: string) => chatId && socket.leave(`chat:${chatId}`));

    socket.on('typing_start', (chatId: string) => {
      if (chatId) socket.to(`chat:${chatId}`).emit('user_typing_start', { chatId, userId, username: user.username });
    });

    socket.on('typing_stop', (chatId: string) => {
      if (chatId) socket.to(`chat:${chatId}`).emit('user_typing_stop', { chatId, userId });
    });

    // Register modular message and WebRTC call event handlers
    registerMessageHandler(io, socket, userSocketsMap);
    registerCallHandler(io, socket, userSocketsMap);

    socket.on('disconnect', async () => {
      const userSockets = userSocketsMap.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          userSocketsMap.delete(userId);
          const now = new Date();
          try {
            await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: now });
            io.emit('user_status_change', { userId, isOnline: false, lastSeen: now.toISOString() });
          } catch (err) {
            console.error('Error setting offline status:', err);
          }
        }
      }
    });
  });

  return io;
}
