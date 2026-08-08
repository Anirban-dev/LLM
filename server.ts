import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { connectDB } from './src/server/db';
import { initializeSocketIO } from './src/server/socket';
import authRoutes from './src/server/routes/auth';
import chatRoutes from './src/server/routes/chats';
import messageRoutes from './src/server/routes/messages';
import ttsRoutes from './src/server/routes/tts';
import personaRoutes from './src/server/routes/persona';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. Connect MongoDB
  await connectDB();

  // 2. Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve audio uploads folder statically
  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  // 3. API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/chats', chatRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/tts', ttsRoutes);
  app.use('/api/persona', personaRoutes);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });

  // 4. Create HTTP server & Socket.io instance
  const server = http.createServer(app);
  initializeSocketIO(server);

  // 5. Vite middleware for dev or Static files for prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 6. Start listening
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
