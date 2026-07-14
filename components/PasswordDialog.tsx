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
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="rounded-xl bg-indigo-500/10 p-2 text-indigo-500"><KeyRound className="h-5 w-5" /></div>
            <div>
              <h3 className="text-lg font-bold text-primary">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{message}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="rounded-full p-2 text-muted hover:bg-muted/10 hover:text-primary" aria-label="Tutup">
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
              className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-primary focus:border-indigo-500 focus:outline-none"
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
                className="w-full rounded-xl border border-border bg-background px-3 py-3 text-sm text-primary focus:border-indigo-500 focus:outline-none"
                autoComplete="new-password"
              />
            </label>
          )}
          {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-500">{error}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-border p-4">
          <button type="button" onClick={onCancel} className="rounded-2xl border border-border px-4 py-3 text-sm font-bold text-primary hover:bg-muted/10">Batal</button>
          <button type="submit" className="rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-background hover:opacity-90">{mode === 'create' ? 'Buat password' : 'Lanjutkan'}</button>
        </div>
      </form>
    </div>
  );
};

export default PasswordDialog;
