import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chatapp-db';

  console.log(`🔌 Connecting to MongoDB URI: ${uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB successfully!');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}



