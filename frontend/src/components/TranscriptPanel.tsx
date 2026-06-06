import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, ChevronUp } from 'lucide-react';
import type { TranscriptEntry } from '../hooks/useSofia';

interface TranscriptPanelProps {
  transcript: TranscriptEntry[];
  connected: boolean;
}

export function TranscriptPanel({ transcript, connected }: TranscriptPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcript]);

  if (!connected) return null;

  const content = (
    <div ref={containerRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-3 min-h-0">
      <AnimatePresence initial={false}>
        {transcript.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-slate-500 text-center py-8"
          >
            Conversation will appear here in real time…
          </motion.p>
        ) : (
          transcript.map((entry, idx) => (
            <motion.div
              key={`${idx}-${entry.text.slice(0, 12)}`}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className={`flex flex-col ${entry.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500 mb-1.5 font-medium">
                {entry.role === 'user' ? 'Guest' : 'Sofia'}
              </span>
              <div
                className={`max-w-[92%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-lg ${
                  entry.role === 'user'
                    ? 'bg-indigo-500/25 text-indigo-50 border border-indigo-400/20 rounded-tr-md backdrop-blur-xl'
                    : 'bg-white/5 text-slate-100 border border-white/10 rounded-tl-md backdrop-blur-xl'
                }`}
              >
                {entry.text}
              </div>
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      {/* Desktop panel */}
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 24 }}
        className="hidden lg:flex absolute left-6 top-28 bottom-36 w-[380px] z-20 flex-col rounded-3xl border border-white/10 bg-slate-950/40 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-medium text-slate-200">Live Transcript</span>
          <span className="ml-auto flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        </div>
        {content}
      </motion.div>

      {/* Mobile drawer */}
      <div className="lg:hidden fixed inset-x-0 bottom-24 z-30 px-4">
        <motion.button
          onClick={() => setMobileOpen(!mobileOpen)}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-xl shadow-xl"
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            <span className="text-sm text-slate-200">Transcript ({transcript.length})</span>
          </div>
          <ChevronUp className={`w-4 h-4 text-slate-400 transition-transform ${mobileOpen ? 'rotate-180' : ''}`} />
        </motion.button>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 280 }}
              exit={{ opacity: 0, y: 20, height: 0 }}
              className="mt-2 rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-2xl overflow-hidden flex flex-col shadow-2xl"
            >
              {content}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
