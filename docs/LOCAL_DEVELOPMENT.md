# Local Development Guide

This guide covers setting up and running ChatApp locally on your machine using `npm run dev` alongside self-hosted utility infrastructure (MongoDB & MinIO S3 Object Storage) via Docker Compose.

---

## 📋 Prerequisites

- **Node.js**: `v20.x` or later
- **npm**: `v10.x` or later
- **Docker & Docker Compose**: For running MongoDB and MinIO Object Storage
- **Ollama** (Installed locally): Serves local LLM models at `http://127.0.0.1:11434`

---

## 🛠️ Step-by-Step Local Setup

### Step 1: Start MongoDB & MinIO Object Storage in Docker

Start the MongoDB database and MinIO S3-compatible Object Storage containers:

```bash
docker compose -f docker-compose.dev.yml up -d
```

This boots:
1. **MongoDB**: `127.0.0.1:27017`
2. **MinIO Object Storage S3 API**: `http://127.0.0.1:9000`
3. **MinIO Web Console UI**: `http://127.0.0.1:9001` (Login: `minioadmin` / `minioadmin`)
4. **Auto-Bucket Creator**: Automatically provisions the `chatapp-media` bucket with public download permissions.

### Step 2: Ensure Local Ollama is Running

Start your local Ollama runner and model:

```bash
ollama run llama3.2:3b
```

### Step 3: Configure Environment Variables

Create or update your `.env` file at the root directory:

```env
NODE_ENV=development
PORT=3000

# Database Configuration
MONGO_URI=mongodb://127.0.0.1:27017/chatapp-db

# Authentication Secret
JWT_SECRET=chatapp_secret_jwt_key_2026

# AI API Service Configuration (Local Ollama)
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_API_KEY=ollama

# MinIO / Self-Hosted S3 Object Storage
S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_NAME=chatapp-media
S3_PUBLIC_URL=http://127.0.0.1:9000/chatapp-media
```

### Step 4: Install Dependencies & Run App

```bash
npm install
npm run dev
```

The application will launch on **`http://localhost:3000`**. All uploaded images, documents, videos, and generated audio voice notes will be automatically stored in your self-hosted MinIO object storage bucket.
