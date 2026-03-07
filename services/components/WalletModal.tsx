
import React, { useState, useEffect } from 'react';
import { X, Wallet as WalletIcon, Save } from 'lucide-react';
import { Wallet } from '../types';

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

  if (!isOpen) return null;

  const handleSave = () => {
      const balance = parseFloat(initialBalance) || 0;
      onSave(name, type, balance, color);
      onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-primary">{mode === 'add' ? 'Add Wallet' : 'Edit Wallet'}</h3>
          <button onClick={onClose} className="text-muted hover:text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4 mb-6">
            <div>
                <label className="block text-xs font-medium text-muted mb-1">Wallet Name</label>
                <input
                    type="text"
                    autoFocus
                    className="w-full bg-background border border-border rounded-lg p-3 text-primary focus:outline-none focus:border-indigo-500 placeholder-muted/50"
                    placeholder="e.g. Main Wallet, BCA, GoPay"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-muted mb-1">Type</label>
                    <select 
                        value={type}
                        onChange={(e) => setType(e.target.value as any)}
                        className="w-full bg-background border border-border rounded-lg p-3 text-primary focus:outline-none focus:border-indigo-500"
                    >
                        <option value="cash">Cash</option>
                        <option value="bank">Bank</option>
                        <option value="ewallet">E-Wallet</option>
                        <option value="cc">Credit Card</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-muted mb-1">Color</label>
                    <div className="flex items-center gap-2 bg-background border border-border rounded-lg p-2.5">
                        <div className={`w-5 h-5 rounded-full ${color}`}></div>
                        <div className="flex-1 flex gap-1 overflow-x-auto no-scrollbar">
                             {COLORS.map(c => (
                                 <button 
                                    key={c}
                                    onClick={() => setColor(c)}
                                    className={`w-4 h-4 rounded-full ${c} ${color === c ? 'ring-2 ring-primary' : 'opacity-50 hover:opacity-100'}`}
                                 />
                             ))}
                        </div>
                    </div>
                </div>
            </div>
            
            <div>
                <label className="block text-xs font-medium text-muted mb-1">Initial Balance</label>
                <input
                    type="number"
                    className="w-full bg-background border border-border rounded-lg p-3 text-primary focus:outline-none focus:border-indigo-500 placeholder-muted/50"
                    placeholder="0"
                    value={initialBalance}
                    onChange={(e) => setInitialBalance(e.target.value)}
                />
                <p className="text-[10px] text-muted mt-1">
                    {type === 'cc' ? 'Current outstanding debt amount (how much you owe).' : 'Starting amount before any recorded transactions.'}
                </p>
            </div>
        </div>

        <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted hover:text-primary">Cancel</button>
            <button 
                onClick={handleSave}
                disabled={!name.trim()}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
                <Save className="w-4 h-4" /> Save
            </button>
        </div>
      </div>
    </div>
  );
};

export default WalletModal;
