import { motion } from 'framer-motion';
import type { ConnectionState, VoiceState } from '../hooks/useSofia';

const STATE_CONFIG: Record<VoiceState, { label: string; color: string; dot: string }> = {
  idle: { label: 'Ready', color: 'text-slate-400', dot: 'bg-slate-500' },
  listening: { label: 'Listening', color: 'text-emerald-300', dot: 'bg-emerald-400' },
  thinking: { label: 'Thinking', color: 'text-violet-300', dot: 'bg-violet-400' },
  speaking: { label: 'Speaking', color: 'text-blue-300', dot: 'bg-blue-400' },
};

interface VoiceStateBadgeProps {
  voiceState: VoiceState;
  connectionState: ConnectionState;
  duration: number;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function VoiceStateBadge({ voiceState, connectionState, duration }: VoiceStateBadgeProps) {
  if (connectionState !== 'connected') return null;

  const cfg = STATE_CONFIG[voiceState];

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="absolute top-24 left-1/2 -translate-x-1/2 z-20"
    >
      <div className="flex items-center gap-3 px-5 py-2.5 rounded-full border border-white/10 bg-slate-950/50 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-1 h-4">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className={`w-1 rounded-full ${cfg.dot}`}
              animate={{
                height:
                  voiceState === 'speaking' ? [4, 14, 4] :
                  voiceState === 'listening' ? [4, 10, 4] :
                  voiceState === 'thinking' ? [4, 8, 4, 12, 4] : 4,
              }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }}
            />
          ))}
        </div>
        <span className={`text-sm font-medium capitalize tracking-wide ${cfg.color}`}>{cfg.label}</span>
        <span className="text-xs text-slate-500 font-mono tabular-nums">{formatDuration(duration)}</span>
      </div>
    </motion.div>
  );
}
