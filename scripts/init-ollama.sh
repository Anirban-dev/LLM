#!/bin/sh

echo "⏳ Waiting for Ollama service to start..."
while ! nc -z ollama 11434; do
  sleep 1
done

echo "🚀 Pulling local CPU models in Ollama..."
echo "1/2 Pulling Llama 3.2 3B model (for persona extraction and clone chat)..."
docker exec -i whatsapp-ollama ollama pull llama3.2:3b || true

echo "2/2 Pulling Whisper model (for local speech-to-text)..."
docker exec -i whatsapp-ollama ollama pull whisper || true

echo "✅ Ollama local models initialized successfully!"
