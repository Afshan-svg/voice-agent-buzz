import { useEffect, useRef } from 'react';
import type { VoiceState } from '../hooks/useSofia';

interface CanvasWaveformProps {
  waveformBands: number[];
  voiceState: VoiceState;
  volume: number;
  inputVolume: number;
  active: boolean;
}

export function CanvasWaveform({ waveformBands, voiceState, volume, inputVolume, active }: CanvasWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const size = Math.min(window.innerWidth * 0.55, 420);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;
      const baseR = size * 0.28;

      const intensity = voiceState === 'speaking' ? volume : voiceState === 'listening' ? inputVolume : 0.08;
      const color =
        voiceState === 'speaking' ? '59, 130, 246' :
        voiceState === 'listening' ? '16, 185, 129' :
        voiceState === 'thinking' ? '139, 92, 246' : '99, 102, 241';

      ctx.beginPath();
      for (let i = 0; i <= 128; i++) {
        const angle = (i / 128) * Math.PI * 2 - Math.PI / 2;
        const band = waveformBands[Math.floor((i / 128) * waveformBands.length)] ?? 0;
        const r = baseR + band * size * 0.08 * (1 + intensity * 2);
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(${color}, ${0.35 + intensity * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = `rgba(${color}, 0.5)`;
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [waveformBands, voiceState, volume, inputVolume, active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute left-1/2 top-[48%] md:top-[46%] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[5] opacity-80"
      aria-hidden
    />
  );
}
