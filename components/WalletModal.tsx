
import React, { useState, useEffect } from 'react';
import { X, Wallet as WalletIcon, Save } from 'lucide-react';
import { Wallet } from '../types';
import PresencePanel from '../motion/PresencePanel';
import { responsiveModal } from './layout/contentSurface';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, type: Wallet['type'], initialBalance: number, color: string) => void;
  initialData?: Wallet;
  mode: 'add' | 'edit';
}

const COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 
  'bg-amber-500', 'bg-red-500', 'bg-pink-500', 'bg-slate-500'
];

const COLOR_LABELS: Record<string, string> = {
  'bg-blue-500': 'Biru',
  'bg-emerald-500': 'Emerald',
  'bg-purple-500': 'Ungu',
  'bg-amber-500': 'Amber',
  'bg-red-500': 'Koral',
  'bg-pink-500': 'Merah muda',
  'bg-slate-500': 'Abu-abu',
};

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onSave, initialData, mode }) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<Wallet['type']>('cash');
  const [initialBalance, setInitialBalance] = useState<string>('');
  const [color, setColor] = useState('bg-blue-500');

  useEffect(() => {
    if (isOpen) {
        if (mode === 'edit' && initialData) {
            setName(initialData.name);
            setType(initialData.type);
            setInitialBalance(initialData.initialBalance.toString());
            setColor(initialData.color);
        } else {
            setName('');
            setType('cash');
            setInitialBalance('');
            setColor('bg-blue-500');
        }
    }
  }, [isOpen, initialData, mode]);

  const handleSave = () => {
      const balance = parseFloat(initialBalance) || 0;
      onSave(name, type, balance, color);
      onClose();
  };

  return (
    <PresencePanel
      isOpen={isOpen}
      onClose={onClose}
      overlayClassName={responsiveModal.sheetOverlay}
      panelClassName={`${responsiveModal.formPanel} max-h-[90dvh] lg:max-w-xl`}
      presentation="form"
      closeOnBackdrop={false}
      ariaLabel={mode === 'add' ? 'Tambah wallet' : 'Edit wallet'}
    >
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500" aria-hidden="true">
              <WalletIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold tracking-tight text-primary">{mode === 'add' ? 'Tambah wallet' : 'Edit wallet'}</h3>
              <p className="text-xs text-muted">Saldo awal tidak mengubah transaksi yang sudah tercatat.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-black/[0.04] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 dark:hover:bg-white/[0.06]"
            aria-label="Tutup form wallet"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
            <div>
                <label htmlFor="wallet-name" className="mb-1.5 block text-xs font-semibold text-primary">Nama wallet</label>
                <input
                    id="wallet-name"
                    type="text"
                    autoFocus
                    required
                    className="min-h-11 w-full rounded-xl border border-border/80 bg-background/70 px-3.5 py-2.5 text-primary outline-none transition placeholder:text-muted/60 focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10"
                    placeholder="Contoh: Rekening utama, BCA, GoPay"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
                <div>
                    <label htmlFor="wallet-type" className="mb-1.5 block text-xs font-semibold text-primary">Jenis wallet</label>
                    <select 
                        id="wallet-type"
                        value={type}
                        onChange={(e) => setType(e.target.value as Wallet['type'])}
                        className="min-h-11 w-full rounded-xl border border-border/80 bg-background/70 px-3.5 py-2.5 text-primary outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10"
                    >
                        <option value="cash">Tunai</option>
                        <option value="bank">Bank</option>
                        <option value="ewallet">E-wallet</option>
                        <option value="investment">Investasi</option>
                        <option value="cc">Kartu kredit</option>
                    </select>
                </div>
                <fieldset>
                    <legend className="mb-1.5 block text-xs font-semibold text-primary">Warna penanda</legend>
                    <div className="flex min-h-11 items-center gap-1 overflow-x-auto rounded-xl bg-background/70 px-1.5 ring-1 ring-inset ring-border/70 no-scrollbar">
                             {COLORS.map(c => (
                                 <button 
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    className="flex h-11 min-w-10 items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70"
                                    aria-label={`Gunakan warna ${COLOR_LABELS[c]}`}
                                    aria-pressed={color === c}
                                 >
                                    <span className={`h-5 w-5 rounded-full ${c} ${color === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'opacity-55 hover:opacity-100'}`} />
                                 </button>
                             ))}
                    </div>
                </fieldset>
            </div>
            
            <div>
                <label htmlFor="wallet-initial-balance" className="mb-1.5 block text-xs font-semibold text-primary">
                  {type === 'cc' ? 'Utang awal kartu kredit' : 'Saldo awal'}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">Rp</span>
                <input
                    id="wallet-initial-balance"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    aria-describedby="wallet-balance-help"
                    className="min-h-12 w-full rounded-xl border border-border/80 bg-background/70 py-2.5 pl-12 pr-3.5 text-lg font-semibold tabular-nums tracking-tight text-primary outline-none transition placeholder:text-muted/60 focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10"
                    placeholder="0"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                />
                </div>
                <p id="wallet-balance-help" className="mt-2 text-xs leading-relaxed text-muted">
                    {type === 'cc'
                      ? 'Masukkan jumlah yang saat ini harus Anda bayar. Nilai ini diperlakukan sebagai utang.'
                      : type === 'investment'
                        ? 'Nilai portofolio sebelum transaksi investasi pertama yang tercatat di Arkaiv.'
                        : 'Jumlah yang sudah tersedia sebelum transaksi pertama yang tercatat di Arkaiv.'}
                </p>
            </div>
        </div>

        <div className="shrink-0 border-t border-border/60 bg-surface/98 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:p-6">
          <div className={responsiveModal.footer}>
            <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-4 text-sm font-medium text-muted transition-colors hover:bg-muted/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60">Batal</button>
            <button 
                type="button"
                onClick={handleSave}
                disabled={!name.trim()}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/15 transition-colors hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50"
            >
                <Save className="w-4 h-4" /> {mode === 'add' ? 'Tambah wallet' : 'Simpan perubahan'}
            </button>
          </div>
        </div>
    </PresencePanel>
  );
};

export default WalletModal;
