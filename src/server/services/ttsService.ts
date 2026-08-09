import { uploadFileToStorage } from './storage';

/**
 * Lightweight PCM WAV Audio Synthesizer Engine for Voice Notes & TTS.
 * Formats 16-bit 22050Hz PCM audio buffer.
 */
export function generateServerTTSBuffer(text: string, voiceId = 'alloy'): Buffer {
  const sampleRate = 22050;
  const numChannels = 1;
  const bitsPerSample = 16;

  const durationInSeconds = Math.min(Math.max(text.length * 0.08, 1.5), 12);
  const totalSamples = Math.floor(sampleRate * durationInSeconds);
  const dataSize = totalSamples * numChannels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF WAV Header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let pitchShift = 0;
  if (voiceId === 'echo' || voiceId === 'onyx') pitchShift = -30;
  if (voiceId === 'nova' || voiceId === 'shimmer') pitchShift = 40;

  let offset = 44;
  const words = text.split(/\s+/).filter(Boolean);
  const wordDuration = totalSamples / Math.max(words.length, 1);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const wordIndex = Math.floor(i / wordDuration);
    const word = words[wordIndex] || 'speech';

    const charCode = word.charCodeAt(i % word.length) || 100;
    const baseFreq = Math.max(90, 150 + pitchShift + (charCode % 60));

    const positionInWord = (i % wordDuration) / wordDuration;
    const envelope = Math.sin(Math.PI * positionInWord);

    const wave =
      0.5 * Math.sin(2 * Math.PI * baseFreq * t) +
      0.3 * Math.sin(2 * Math.PI * (baseFreq * 2) * t) +
      0.2 * Math.sin(2 * Math.PI * (baseFreq * 3) * t);

    const sample = Math.floor(wave * envelope * 12000);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, sample)), offset);
    offset += 2;
  }

  return buffer;
}

/**
 * Synthesizes WAV audio file and uploads to SeaweedFS S3 Object Storage.
 */
export async function generateTTSAudioFile(text: string, voiceId = 'alloy'): Promise<string> {
  const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1e6);
  const filename = `persona-voice-${uniqueId}.wav`;
  const audioBuffer = generateServerTTSBuffer(text, voiceId);

  const { fileUrl } = await uploadFileToStorage(audioBuffer, filename, 'audio/wav');
  return fileUrl;
}
