import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, Check, X } from 'lucide-react';
import { FeatureTutorial } from '../utils/featureTutorials';

interface FeatureTutorialPopupProps {
  tutorial: FeatureTutorial | null;
  onClose: () => void;
  onDisableAll: () => void;
}

const FeatureTutorialPopup: React.FC<FeatureTutorialPopupProps> = ({ tutorial, onClose, onDisableAll }) => {
  return (
    <AnimatePresence>
      {tutorial && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[96] flex items-end sm:items-center justify-center p-4 bg-black/55 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 24 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="bg-surface border border-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
          >
            <div className="p-5 border-b border-border flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-2xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-indigo-500">{tutorial.eyebrow}</div>
                  <h3 className="text-xl font-bold text-primary leading-tight">{tutorial.title}</h3>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-muted hover:text-primary hover:bg-muted/10 transition-colors"
                aria-label="Close tutorial"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <p className="text-sm text-muted leading-relaxed">{tutorial.body}</p>
              <ul className="space-y-3">
                {tutorial.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3 text-sm text-primary">
                    <span className="mt-0.5 p-1 bg-emerald-500/10 text-emerald-500 rounded-full shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                    <span className="leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-2xl bg-primary text-background font-bold hover:opacity-90 transition-opacity"
                >
                  Got it
                </button>
                <button
                  onClick={onDisableAll}
                  className="px-4 py-3 rounded-2xl text-sm text-muted hover:text-primary hover:bg-muted/10 font-medium transition-colors"
                >
                  Don’t show tips
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FeatureTutorialPopup;
