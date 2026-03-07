
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-xl w-full max-w-xs shadow-2xl p-6 text-center">
        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
            <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-primary mb-2">{title}</h3>
        <p className="text-sm text-muted mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-center">
            <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-muted hover:text-primary bg-primary/5 hover:bg-primary/10 transition-colors">Cancel</button>
            <button onClick={onConfirm} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-400 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
