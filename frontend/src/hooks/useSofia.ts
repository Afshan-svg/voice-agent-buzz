import { useState, useRef, useCallback } from 'react';

export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
}

const WAVEFORM_BANDS = 64;

const ULAW_BIAS = 132;
const ULAW_CLIP = 32635;

function encodeUlaw(pcm16: Int16Array): Uint8Array {
  const ulaw = new Uint8Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    let sample = pcm16[i];
    let sign = (sample >> 8) & 0x80;
    if (sign !== 0) sample = -sample;
    if (sample > ULAW_CLIP) sample = ULAW_CLIP;
    sample += ULAW_BIAS;
    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}
    let mantissa = (sample >> (exponent + 3)) & 0x0f;
    ulaw[i] = ~(sign | (exponent << 4) | mantissa);
  }
  return ulaw;
}

function decodeUlaw(ulaw: Uint8Array): Int16Array {
  const pcm16 = new Int16Array(ulaw.length);
  for (let i = 0; i < ulaw.length; i++) {
    let sample = ~ulaw[i];
    let sign = sample & 0x80;
    let exponent = (sample >> 4) & 0x07;
    let mantissa = sample & 0x0f;
    let decoded = ((mantissa << 3) + 132) << exponent;
    decoded -= 132;
    pcm16[i] = sign !== 0 ? -decoded : decoded;
  }
  return pcm16;
}

function createEmptyBands(): number[] {
  return Array.from({ length: WAVEFORM_BANDS }, () => 0);
}

function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  return window.location.origin;
}

function buildBrowserSessionWebSocketUrl(): string {
  const url = new URL('/ws/browser-session', getApiBaseUrl());
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
}

export function useSofia() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0);
  const [inputVolume, setInputVolume] = useState(0);
  const [waveformBands, setWaveformBands] = useState<number[]>(createEmptyBands);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const durationIntervalRef = useRef<number | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isMutedRef = useRef(false);

  const updateAudioMetrics = useCallback(() => {
    const outputAnalyser = outputAnalyserRef.current;
    const inputAnalyser = inputAnalyserRef.current;

    if (outputAnalyser) {
      const data = new Uint8Array(outputAnalyser.frequencyBinCount);
      outputAnalyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      setVolume(sum / data.length / 255);

      const bands = createEmptyBands();
      const step = Math.floor(data.length / WAVEFORM_BANDS);
      for (let i = 0; i < WAVEFORM_BANDS; i++) {
        let bandSum = 0;
        for (let j = 0; j < step; j++) bandSum += data[i * step + j] ?? 0;
        bands[i] = bandSum / step / 255;
      }
      setWaveformBands(bands);
    }

    if (inputAnalyser) {
      const data = new Uint8Array(inputAnalyser.frequencyBinCount);
      inputAnalyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      setInputVolume(Math.min(1, Math.sqrt(sum / data.length) * 4));
    }

    animationFrameRef.current = requestAnimationFrame(updateAudioMetrics);
  }, []);

  const connect = async () => {
    try {
      setConnectionState('connecting');
      setTranscript([]);
      setDuration(0);
      setWaveformBands(createEmptyBands());

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      mediaStreamRef.current = stream;

      const ws = new WebSocket(buildBrowserSessionWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'start' }));
        setConnectionState('connected');
        startAudioCapture(stream);
        durationIntervalRef.current = window.setInterval(() => setDuration((d) => d + 1), 1000);
        animationFrameRef.current = requestAnimationFrame(updateAudioMetrics);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'media') handleAudioData(msg.payload);
        else if (msg.type === 'clear') {
          playbackQueueRef.current = [];
          if (activeSourceRef.current) {
            try { activeSourceRef.current.stop(); } catch { /* noop */ }
            activeSourceRef.current = null;
          }
          isPlayingRef.current = false;
        } else if (msg.type === 'transcript') {
          setTranscript((prev) => [...prev, { role: msg.role, text: msg.text }]);
        } else if (msg.type === 'status') {
          setVoiceState(msg.status);
        }
      };

      ws.onclose = () => disconnect();
      ws.onerror = () => {
        setConnectionState('error');
        disconnect();
      };
    } catch (err) {
      console.error('Failed to connect:', err);
      setConnectionState('error');
    }
  };

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'stop' }));
        wsRef.current.close();
      } catch { /* noop */ }
      wsRef.current = null;
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    audioContextRef.current?.close();
    audioContextRef.current = null;
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setConnectionState('disconnected');
    setVoiceState('idle');
    setVolume(0);
    setInputVolume(0);
    setWaveformBands(createEmptyBands());
  }, []);

  const startAudioCapture = (stream: MediaStream) => {
    const audioCtx = new AudioContext({ sampleRate: 8000 });
    audioContextRef.current = audioCtx;

    const source = audioCtx.createMediaStreamSource(stream);
    const inputAnalyser = audioCtx.createAnalyser();
    inputAnalyser.fftSize = 256;
    inputAnalyserRef.current = inputAnalyser;
    source.connect(inputAnalyser);

    const processor = audioCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;
    processor.onaudioprocess = (e) => {
      if (isMutedRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      const ulaw = encodeUlaw(pcm16);
      let binary = '';
      for (let i = 0; i < ulaw.length; i++) binary += String.fromCharCode(ulaw[i]);
      wsRef.current.send(JSON.stringify({ type: 'media', payload: btoa(binary) }));
    };
    source.connect(processor);
    processor.connect(audioCtx.destination);

    const outputAnalyser = audioCtx.createAnalyser();
    outputAnalyser.fftSize = 512;
    outputAnalyser.smoothingTimeConstant = 0.75;
    outputAnalyserRef.current = outputAnalyser;
    outputAnalyser.connect(audioCtx.destination);
  };

  const handleAudioData = (base64: string) => {
    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;
    const binary = atob(base64);
    const ulaw = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) ulaw[i] = binary.charCodeAt(i);
    const pcm16 = decodeUlaw(ulaw);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;
    playbackQueueRef.current.push(float32);
    playNextAudio();
  };

  const playNextAudio = () => {
    const audioCtx = audioContextRef.current;
    if (!audioCtx || isPlayingRef.current || playbackQueueRef.current.length === 0) return;
    isPlayingRef.current = true;

    const playChunk = () => {
      if (playbackQueueRef.current.length === 0) {
        isPlayingRef.current = false;
        return;
      }
      const chunk = playbackQueueRef.current.shift()!;
      const buffer = audioCtx.createBuffer(1, chunk.length, 8000);
      buffer.getChannelData(0).set(chunk);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      if (outputAnalyserRef.current) {
        source.connect(outputAnalyserRef.current);
        outputAnalyserRef.current.connect(audioCtx.destination);
      } else {
        source.connect(audioCtx.destination);
      }
      activeSourceRef.current = source;
      const startTime = Math.max(audioCtx.currentTime, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + buffer.duration;
      source.onended = () => {
        if (activeSourceRef.current === source) activeSourceRef.current = null;
        playChunk();
      };
    };
    playChunk();
  };

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      return next;
    });
  };

  return {
    connectionState,
    voiceState,
    isMuted,
    transcript,
    duration,
    volume,
    inputVolume,
    waveformBands,
    connect,
    disconnect,
    toggleMute,
  };
};
