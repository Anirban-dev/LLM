# ChatApp - Full-Stack Mobile-Responsive AI & Messaging Platform

ChatApp is a real-time, cross-platform messaging application featuring **Phase 3 AI Personas**, unified human & AI chat rooms, token-by-token streaming responses via OpenAI-compatible backend services, server-side TTS voice notes, **self-hosted MinIO S3 Object Storage**, and rich media attachment support (Images, Documents, Video, Audio) with a strict **10MB upload limit**.

---

## 🌟 Key Features

### 1. 📦 Self-Hosted MinIO S3 Object Storage
- Integrated **MinIO** S3-compatible Object Storage for hosting uploaded images, videos, documents, and generated voice notes.
- Includes a web management console at `http://localhost:9001` (`minioadmin` / `minioadmin`).
- Graceful automatic fallback to local disk storage if Object Storage is not running.

### 2. 🤖 AI Personas & AI Clones
- **Custom AI Personas**: Define custom personas with tabbed settings (Identity, Directives & Greeting, Model Parameters, and Voice Settings).
- **Auto-Extractor & Persona Clones**: Parse plain text descriptions or import `my_persona.json` files to instantly generate AI friend clones.
- **OpenAI & Gemini & Local Ollama**: Connect seamlessly to local Ollama (`llama3.2:3b`), OpenAI `gpt-4o`, or Gemini `gemini-2.5-flash`.
- **Sliding History Window**: AI Personas analyze the last **10 messages** in conversation history for context-aware responses.

### 3. ⚡ Real-Time Socket.io Engine & Streaming
- **Token-by-Token LLM Streaming**: Real-time token streaming (`ai_stream_start`, `ai_stream_chunk`, `ai_stream_end`) directly over Socket.io.
- **Unified Chat Rooms**: Interact seamlessly with human contacts and AI Personas in 1-on-1 and group chats.

### 4. 🎙️ Server-Side Voice Replies (TTS) & STT
- **Automatic Audio Note Generation**: Synthesizes 16-bit PCM WAV audio files on the server (`alloy`, `echo`, `onyx`, `nova`, `shimmer`).
- **Object Storage Persistence**: Generated audio files are stored in MinIO for instant, reliable client playback.

### 5. 📎 Rich Media Attachments (10MB Max Limit)
- Support for uploading **Images**, **PDFs/Documents**, **Videos**, and **Voice Notes** up to **10MB**.

---

## 📁 Detailed Documentation Guides

To set up and run the project across various environments, refer to the guides in the `docs/` folder:

- 💻 **[Local Development Guide](docs/LOCAL_DEVELOPMENT.md)** - Run utility services (MongoDB & MinIO Object Storage) via Docker Compose and launch the app with `npm run dev`.
- 🖥️ **[Electron Desktop Application Guide](docs/ELECTRON_DESKTOP.md)** - Run in desktop window mode and package native installers for Windows, macOS, and Linux.
- 📱 **[Android Mobile Application Guide](docs/MOBILE_ANDROID.md)** - Sync and build native Android APKs via Capacitor and Android Studio.

---

## 🚀 Quick Start (Local Development)

```bash
# 1. Start MongoDB and MinIO Object Storage in Docker
docker compose -f docker-compose.dev.yml up -d

# 2. Install dependencies
npm install

# 3. Configure environment variables (.env)
cp .env.example .env

# 4. Start the Node.js / Vite server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
