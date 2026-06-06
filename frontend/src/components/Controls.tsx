import { motion } from 'framer-motion';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import type { ConnectionState } from '../hooks/useSofia';

interface ControlsProps {
  connectionState: ConnectionState;
  isMuted: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleMute: () => void;
}

export function Controls({ connectionState, isMuted, onConnect, onDisconnect, onToggleMute }: ControlsProps) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 pb-6 md:pb-10 pt-4 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.2 }}
        className="flex justify-center pointer-events-auto px-4"
      >
        <div className="flex items-center gap-2 p-2 rounded-full border border-white/10 bg-slate-950/60 backdrop-blur-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
          {connectionState === 'connected' ? (
            <>
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.96 }}
                onClick={onToggleMute}
                className={`p-3.5 md:p-4 rounded-full transition-colors ${
                  isMuted ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onDisconnect}
                className="px-6 md:px-8 py-3.5 md:py-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-sm md:text-base font-medium flex items-center gap-2 shadow-lg shadow-rose-900/30"
              >
                <PhoneOff className="w-4 h-4 md:w-5 md:h-5" />
                <span className="hidden sm:inline">End Conversation</span>
                <span className="sm:hidden">End</span>
              </motion.button>
            </>
          ) : (
            <motion.button
              whileHover={{ scale: 1.03, boxShadow: '0 0 40px rgba(99,102,241,0.4)' }}
              whileTap={{ scale: 0.97 }}
              onClick={onConnect}
              disabled={connectionState === 'connecting'}
              className="px-8 md:px-12 py-3.5 md:py-4 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium flex items-center gap-3 disabled:opacity-50 shadow-xl shadow-indigo-900/40 text-sm md:text-base"
            >
              <Phone className="w-5 h-5" />
              {connectionState === 'connecting' ? 'Connecting…' : 'Start Conversation'}
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export function Metrics() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4, type: 'spring', stiffness: 180, damping: 22 }}
      className="hidden xl:flex absolute right-8 top-32 z-20 flex-col gap-3"
    >
      {[
        { label: 'Calls Answered', display: '12,405' },
        { label: 'Bookings Generated', display: '842' },
        { label: 'Revenue Influenced', display: '$420k+' },
        { label: 'Avg Response', display: '< 800ms' },
      ].map((m) => (
        <motion.div
          key={m.label}
          whileHover={{ scale: 1.02, borderColor: 'rgba(99,102,241,0.3)' }}
          className="px-5 py-4 rounded-2xl border border-white/8 bg-slate-950/35 backdrop-blur-xl w-52 shadow-lg transition-colors"
        >
          <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1">{m.label}</p>
          <p className="text-2xl font-light text-white tabular-nums">{m.display}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}
