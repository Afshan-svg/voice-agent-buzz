import { motion } from 'framer-motion';
import type { ConnectionState } from '../hooks/useSofia';

interface HeaderProps {
  connectionState: ConnectionState;
}

export function Header({ connectionState }: HeaderProps) {
  const statusColor =
    connectionState === 'connected' ? 'bg-emerald-500' :
    connectionState === 'connecting' ? 'bg-amber-500' :
    connectionState === 'error' ? 'bg-rose-500' : 'bg-slate-600';

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 inset-x-0 z-50 px-4 md:px-8 py-4 md:py-5"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <motion.div whileHover={{ scale: 1.02 }} className="flex items-center gap-3 cursor-default">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <span className="text-lg font-bold text-white">B</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-white tracking-tight">BuzznessAI</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Enterprise Voice</p>
          </div>
        </motion.div>

        <p className="hidden md:block text-sm font-medium text-slate-300 tracking-wide">
          Sofia AI Receptionist
        </p>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="flex items-center gap-2.5 px-3 py-1.5 md:px-4 md:py-2 rounded-full border border-white/10 bg-slate-950/40 backdrop-blur-xl"
        >
          <span className="relative flex h-2.5 w-2.5">
            {connectionState === 'connected' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusColor}`} />
          </span>
          <span className="text-xs md:text-sm text-slate-200 capitalize font-medium">{connectionState}</span>
        </motion.div>
      </div>
    </motion.header>
  );
}
