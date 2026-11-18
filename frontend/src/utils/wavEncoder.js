/**
 * Convert a MediaRecorder recording (WebM/Opus chunks) into a 16 kHz mono
 * 16-bit WAV Blob, the format the server's speaker model reads without ffmpeg.
 */
export async function chunksToWav16k(chunks, mimeType = 'audio/webm') {
  const blob = new Blob(chunks, { type: mimeType });
  const arrayBuf = await blob.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  let decoded;
  try {
    decoded = await ctx.decodeAudioData(arrayBuf);
  } finally {
    ctx.close();
  }

  // Mix to mono
  const n = decoded.length;
  const mono = new Float32Array(n);
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const ch = decoded.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += ch[i] / decoded.numberOfChannels;
  }

  // Resample to 16 kHz with the browser's own resampler
  const targetRate = 16000;
  const offline = new OfflineAudioContext(1, Math.ceil((n * targetRate) / decoded.sampleRate), targetRate);
  const buf = offline.createBuffer(1, n, decoded.sampleRate);
  buf.copyToChannel(mono, 0);
  const src = offline.createBufferSource();
  src.buffer = buf;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  return { blob: encodeWav(rendered.getChannelData(0), targetRate), seconds: rendered.duration };
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/** POST a recording to the server's speaker model. purpose: 'register' | 'verify'. */
export async function uploadVoiceSample(client, chunks, purpose, sessionId) {
  const { blob } = await chunksToWav16k(chunks);
  const form = new FormData();
  form.append('audio', blob, 'voice.wav');
  form.append('purpose', purpose);
  if (sessionId) form.append('session_id', sessionId);
  const res = await client.post('/biometric/voice-sample', form, { timeout: 60000 });
  return res.data;
}
