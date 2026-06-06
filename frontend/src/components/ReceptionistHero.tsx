import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import sofiaImage from '../assets/sofia-receptionist.avif';

const CAPABILITIES = ['Room bookings', 'Guest inquiries', 'Check-in & spa'];

export function ReceptionistHero() {
  return (
    <div className="absolute inset-x-0 top-[14%] sm:top-[16%] z-10 flex flex-col items-center px-6 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center max-w-lg w-full"
      >
        {/* Avatar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 22 }}
          className="relative mb-6"
        >
          <div className="absolute inset-0 rounded-3xl bg-indigo-500/25 blur-3xl scale-110" />
          <div className="relative w-40 h-48 sm:w-44 sm:h-52 rounded-3xl p-[2px] bg-gradient-to-br from-indigo-400 via-violet-500 to-blue-600 shadow-[0_0_60px_rgba(99,102,241,0.35)]">
            <div className="w-full h-full rounded-[22px] overflow-hidden bg-slate-950">
              <img
                src={sofiaImage}
                alt="Sofia — AI hotel receptionist with headset"
                className="w-full h-full object-cover object-top"
              />
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full border border-emerald-500/30 bg-slate-950/90 backdrop-blur-md shadow-lg">
            <span className="text-[10px] font-medium text-emerald-300 tracking-wide uppercase">AI Receptionist</span>
          </div>
        </motion.div>

        {/* Identity card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-center mb-5"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 mb-3">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-300 tracking-wide">Available now</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight mb-1">
            Sofia
          </h2>
          <p className="text-sm sm:text-base text-indigo-300/90 font-medium mb-3">
            AI Hotel Receptionist
          </p>
          <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
            Your always-on concierge — handles reservations, guest questions, and hotel services in natural conversation.
          </p>
        </motion.div>

        {/* Capability pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap justify-center gap-2 mb-8"
        >
          {CAPABILITIES.map((cap, i) => (
            <motion.span
              key={cap}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + i * 0.08 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-slate-300 border border-white/10 bg-white/5 backdrop-blur-md"
            >
              <Sparkles className="w-3 h-3 text-indigo-400" />
              {cap}
            </motion.span>
          ))}
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="text-center border-t border-white/5 pt-6 w-full"
        >
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-indigo-300/70 mb-2 font-medium">
            BuzznessAI Luxury Hotels
          </p>
          <h1 className="text-xl sm:text-2xl font-medium text-slate-200 tracking-tight">
            24/7 AI Hotel Receptionist
          </h1>
        </motion.div>
      </motion.div>
    </div>
  );
}
