import React from 'react';
import { BookOpen, Check, Keyboard, MousePointerClick, X } from 'lucide-react';
import { FeatureTutorial } from '../utils/featureTutorials';
import PresencePanel from '../motion/PresencePanel';

interface FeatureTutorialPopupProps {
  tutorial: FeatureTutorial | null;
  onClose: () => void;
  onDisableAll: () => void;
}

const FeatureTutorialPopup: React.FC<FeatureTutorialPopupProps> = ({ tutorial, onClose, onDisableAll }) => {
  return (
    <PresencePanel
      isOpen={Boolean(tutorial)}
      onClose={onClose}
      overlayClassName="fixed inset-0 z-[96] flex items-end justify-center bg-black/55 p-4 backdrop-blur-sm sm:items-center"
      panelClassName="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl lg:max-w-2xl"
      presentation="sheet"
      ariaLabel={tutorial?.title || 'Panduan fitur'}
    >
      {tutorial && (
        <>
            <div className="p-5 lg:p-6 border-b border-border flex items-start justify-between gap-4">
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
                className="flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-muted/10 hover:text-primary"
                aria-label="Tutup panduan"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 lg:p-6 space-y-5">
              <p className="text-sm text-muted leading-relaxed">{tutorial.body}</p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border bg-background/60 p-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                    <MousePointerClick className="w-3 h-3" /> Input manual
                  </div>
                  <p className="text-sm font-medium text-primary leading-relaxed">{tutorial.manualExample}</p>
                </div>
                <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/10 p-3">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-1">
                    <Keyboard className="w-3 h-3" /> Contoh input cepat
                  </div>
                  <p className="text-sm font-semibold text-primary leading-relaxed">{tutorial.inputBarExample}</p>
                </div>
              </div>

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

              <div className="flex flex-col sm:flex-row lg:justify-end gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 lg:flex-none lg:px-8 py-3 rounded-2xl bg-primary text-background font-bold hover:opacity-90 transition-opacity"
                >
                  Mengerti
                </button>
                <button
                  onClick={onDisableAll}
                  className="px-4 py-3 rounded-2xl text-sm text-muted hover:text-primary hover:bg-muted/10 font-medium transition-colors"
                >
                  Jangan tampilkan panduan
                </button>
              </div>
            </div>
        </>
      )}
    </PresencePanel>
  );
};

export default FeatureTutorialPopup;
