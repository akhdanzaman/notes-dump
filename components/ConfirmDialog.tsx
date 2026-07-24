
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { responsiveModal } from './layout/contentSurface';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  tone = 'danger',
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm animate-in fade-in duration-150 dark:bg-black/65">
      <div className={responsiveModal.destructiveConfirmPanel} data-ndz-destructive-confirm="compact-separated">
        <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${tone === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
            <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-primary mb-2">{title}</h3>
        <p className="text-sm text-muted mb-6 leading-relaxed">{message}</p>
        <div className="grid grid-cols-2 gap-2">
            <button onClick={onCancel} className="rounded-xl border border-border/80 px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-black/[0.04] hover:text-primary dark:hover:bg-white/[0.06]">{cancelLabel}</button>
            <button onClick={onConfirm} className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors ${tone === 'danger' ? 'bg-red-500 hover:bg-red-400' : 'bg-indigo-500 hover:bg-indigo-400'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
