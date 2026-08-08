import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoMemoryServer: MongoMemoryServer | null = null;

export async function connectDB(): Promise<void> {
  const primaryUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatapp-db';

  console.log(`🔌 Attempting MongoDB connection to: ${primaryUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

  try {
    // Disable command buffering so operations fail fast instead of hanging 10s if disconnected
    mongoose.set('bufferCommands', false);

    await mongoose.connect(primaryUri, {
      serverSelectionTimeoutMS: 2000, // Quick timeout before falling back
    });
    console.log('✅ Connected to MongoDB server');
  } catch (error) {
    console.warn('⚠️ External/Local MongoDB connection unavailable. Spinning up embedded MongoMemoryServer...');
    
    try {
      mongoMemoryServer = await MongoMemoryServer.create();
      const memoryUri = mongoMemoryServer.getUri();
      console.log(`🚀 MongoMemoryServer started at: ${memoryUri}`);

      await mongoose.connect(memoryUri);
      console.log('✅ Connected to embedded MongoMemoryServer successfully!');
    } catch (memErr) {
      console.error('❌ Failed to start MongoMemoryServer:', memErr);
    }
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
}

