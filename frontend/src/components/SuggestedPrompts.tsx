import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const PROMPTS = [
  'Do you have a deluxe room this weekend?',
  'What time is check-in?',
  'Can you book a sea view suite for two nights?',
  'Tell me about your spa packages.',
];

interface SuggestedPromptsProps {
  visible: boolean;
}

export function SuggestedPrompts({ visible }: SuggestedPromptsProps) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ delay: 0.5, type: 'spring', stiffness: 200, damping: 24 }}
      className="absolute bottom-36 md:bottom-40 left-0 right-0 z-20 flex flex-col items-center px-4 pointer-events-none"
    >
      <div className="flex items-center gap-1.5 mb-3 text-slate-500">
        <Sparkles className="w-3.5 h-3.5" />
        <span className="text-xs uppercase tracking-widest font-medium">Try saying</span>
      </div>
      <div className="flex flex-wrap justify-center gap-2 max-w-2xl pointer-events-auto">
        {PROMPTS.map((prompt, i) => (
          <motion.div
            key={prompt}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + i * 0.08 }}
            whileHover={{ scale: 1.03, y: -2 }}
            className="px-4 py-2 rounded-full text-xs md:text-sm text-slate-300 border border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-indigo-400/30 hover:text-white transition-colors cursor-default shadow-lg"
          >
            &ldquo;{prompt}&rdquo;
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
