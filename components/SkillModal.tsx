
import React, { useState, useEffect } from 'react';
import { X, Target } from 'lucide-react';

interface SkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, weeklyTargetMinutes?: number) => void;
  initialName?: string;
  initialTarget?: number;
  mode: 'add' | 'edit';
}

const SkillModal: React.FC<SkillModalProps> = ({ isOpen, onClose, onSave, initialName = '', initialTarget, mode }) => {
  const [name, setName] = useState(initialName);
  const [targetHours, setTargetHours] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
        setName(initialName);
        // Convert stored minutes to hours for display, default to empty if undefined
        setTargetHours(initialTarget ? (initialTarget / 60).toString() : '');
    }
  }, [isOpen, initialName, initialTarget]);

  if (!isOpen) return null;

  const handleSave = () => {
      const minutes = targetHours ? parseFloat(targetHours) * 60 : undefined;
      onSave(name, minutes);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-primary">{mode === 'add' ? 'Add New Skill' : 'Edit Skill'}</h3>
          <button onClick={onClose} className="text-muted hover:text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4 mb-6">
            <div>
                <label className="block text-xs font-medium text-muted mb-1">Skill Name</label>
                <input
                    type="text"
                    autoFocus
                    className="w-full bg-background border border-border rounded-lg p-3 text-primary focus:outline-none focus:border-indigo-500 placeholder-muted/50"
                    placeholder="e.g. Python, Piano, Writing"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>
            
            <div>
                <label className="block text-xs font-medium text-muted mb-1 flex items-center gap-1">
                    <Target className="w-3 h-3" /> Weekly Target (Hours)
                </label>
                <input
                    type="number"
                    className="w-full bg-background border border-border rounded-lg p-3 text-primary focus:outline-none focus:border-indigo-500 placeholder-muted/50"
                    placeholder="e.g. 5"
                    value={targetHours}
                    onChange={(e) => setTargetHours(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSave();
                    }}
                />
                <p className="text-[10px] text-muted mt-1">Optional. Set a goal to track your weekly progress.</p>
            </div>
        </div>

        <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted hover:text-primary">Cancel</button>
            <button 
                onClick={handleSave}
                disabled={!name.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                Save
            </button>
        </div>
      </div>
    </div>
  );
};

export default SkillModal;
