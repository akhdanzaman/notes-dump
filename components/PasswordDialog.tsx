import React, { useEffect, useState } from 'react';
import { KeyRound, X } from 'lucide-react';

interface PasswordDialogProps {
  isOpen: boolean;
  mode: 'create' | 'verify';
  title: string;
  message: string;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}

const PasswordDialog: React.FC<PasswordDialogProps> = ({
  isOpen,
  mode,
  title,
  message,
  onSubmit,
  onCancel,
}) => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setPassword('');
    setConfirmation('');
    setError('');
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!password.trim()) {
      setError('Password tidak boleh kosong.');
      return;
    }
    if (mode === 'create' && password !== confirmation) {
      setError('Konfirmasi password tidak sama.');
      return;
    }
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm dark:bg-black/65">
      <form onSubmit={submit} className="w-full max-w-sm overflow-hidden rounded-[24px] border border-border/80 bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-500"><KeyRound className="h-5 w-5" /></div>
            <div>
              <h3 className="text-lg font-bold text-primary">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{message}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="rounded-xl p-2 text-muted transition-colors hover:bg-black/[0.04] hover:text-primary dark:hover:bg-white/[0.06]" aria-label="Tutup">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-muted">Password</span>
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(event) => { setPassword(event.target.value); setError(''); }}
              className="w-full rounded-xl border border-border bg-background/70 px-3 py-3 text-sm text-primary outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10"
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            />
          </label>
          {mode === 'create' && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-muted">Ulangi password</span>
              <input
                type="password"
                value={confirmation}
                onChange={(event) => { setConfirmation(event.target.value); setError(''); }}
                className="w-full rounded-xl border border-border bg-background/70 px-3 py-3 text-sm text-primary outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10"
                autoComplete="new-password"
              />
            </label>
          )}
          {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-500">{error}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-border p-4">
          <button type="button" onClick={onCancel} className="rounded-xl border border-border/80 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">Batal</button>
          <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-indigo-500/20 transition-colors hover:bg-indigo-500">{mode === 'create' ? 'Buat password' : 'Lanjutkan'}</button>
        </div>
      </form>
    </div>
  );
};

export default PasswordDialog;
