import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Wallet, Tag, Calendar, DollarSign } from 'lucide-react';
import { BudgetConfig, Wallet as WalletType, BrainDumpItem } from '../types';

interface AddExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (amount: number, description: string, category: string, walletId: string, date: string, type: 'expense' | 'income' | 'transfer' | 'saving', toWalletId?: string, savingGoalId?: string, savingGoalName?: string) => void;
    wallets: WalletType[];
    budgetConfig: BudgetConfig;
    savingGoals: BrainDumpItem[];
}

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ isOpen, onClose, onSave, wallets, budgetConfig, savingGoals }) => {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [walletId, setWalletId] = useState('');
    const [toWalletId, setToWalletId] = useState('');
    const [savingGoalId, setSavingGoalId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [transactionType, setTransactionType] = useState<'expense' | 'income' | 'transfer' | 'saving'>('expense');

    const handleSave = () => {
        if (!amount) return;
        if (transactionType !== 'saving' && !description) return;
        if (transactionType === 'transfer' && (!walletId || !toWalletId)) return;
        if (transactionType === 'saving' && !savingGoalId) return;
        if (transactionType !== 'saving' && transactionType !== 'transfer' && !walletId) return;
        
        const goal = savingGoals.find(g => g.id === savingGoalId);
        const goalName = goal ? goal.content : '';
        const finalWalletId = transactionType === 'saving' ? (goal?.meta.dedicatedWalletId || walletId) : walletId;
        const finalDescription = transactionType === 'saving' ? `Saved for: ${goalName}` : description;
        
        onSave(parseFloat(amount), finalDescription, category, finalWalletId, date, transactionType, toWalletId, savingGoalId, goalName);
        setAmount('');
        setDescription('');
        setCategory('');
        setWalletId('');
        setToWalletId('');
        setSavingGoalId('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className="bg-surface border border-border rounded-t-[32px] sm:rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="p-6 border-b border-border flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                            <DollarSign className={`w-5 h-5 ${transactionType === 'expense' ? 'text-red-500' : transactionType === 'income' ? 'text-green-500' : 'text-indigo-500'}`} />
                            {transactionType.charAt(0).toUpperCase() + transactionType.slice(1)}
                        </h3>
                        <button onClick={onClose} className="p-2 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded-full text-muted transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto">
                        <div className="flex gap-2 p-1 bg-black/5 dark:bg-white/5 rounded-xl">
                            {(['expense', 'income', 'transfer', 'saving'] as const).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setTransactionType(type)}
                                    className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-colors ${transactionType === type ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-primary'}`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">Amount</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold">Rp</span>
                                <input 
                                    type="number"
                                    autoFocus
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-background border border-border rounded-2xl p-4 pl-12 text-primary focus:outline-none focus:border-indigo-500 font-bold text-lg"
                                />
                            </div>
                        </div>

                        {transactionType !== 'saving' && (
                            <div>
                                <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">Description</label>
                                <input 
                                    type="text"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder={transactionType === 'expense' ? "What did you buy?" : transactionType === 'income' ? "Source of income?" : "Description"}
                                    className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            {transactionType === 'saving' ? (
                                <>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">Saving Goal</label>
                                        <select 
                                            value={savingGoalId}
                                            onChange={e => {
                                                setSavingGoalId(e.target.value);
                                                const goal = savingGoals.find(g => g.id === e.target.value);
                                                if (goal?.meta.dedicatedWalletId) {
                                                    setWalletId(goal.meta.dedicatedWalletId);
                                                }
                                            }}
                                            className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium appearance-none"
                                        >
                                            <option value="">Select Goal</option>
                                            {savingGoals.map(g => (
                                                <option key={g.id} value={g.id}>{g.content}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">Wallet</label>
                                        {(() => {
                                            const goal = savingGoals.find(g => g.id === savingGoalId);
                                            if (goal?.meta.dedicatedWalletId) {
                                                const wallet = wallets.find(w => w.id === goal.meta.dedicatedWalletId);
                                                return (
                                                    <div className="w-full bg-background border border-border rounded-2xl p-4 text-muted font-medium flex items-center gap-2">
                                                        <Wallet className="w-4 h-4" />
                                                        {wallet ? wallet.name : 'Linked to Goal'}
                                                    </div>
                                                );
                                            } else {
                                                return (
                                                    <select 
                                                        value={walletId}
                                                        onChange={e => setWalletId(e.target.value)}
                                                        className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium appearance-none"
                                                    >
                                                        <option value="">Select Wallet</option>
                                                        {wallets.map(w => (
                                                            <option key={w.id} value={w.id}>{w.name}</option>
                                                        ))}
                                                    </select>
                                                );
                                            }
                                        })()}
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">Category</label>
                                        <select 
                                            value={category}
                                            onChange={e => setCategory(e.target.value)}
                                            className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium appearance-none"
                                        >
                                            <option value="">Uncategorized</option>
                                            {budgetConfig.rules?.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">{transactionType === 'transfer' ? 'From' : 'Wallet'}</label>
                                        <select 
                                            value={walletId}
                                            onChange={e => setWalletId(e.target.value)}
                                            className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium appearance-none"
                                        >
                                            <option value="">Select Wallet</option>
                                            {wallets.map(w => (
                                                <option key={w.id} value={w.id}>{w.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {transactionType === 'transfer' ? (
                                        <div>
                                            <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">To</label>
                                            <select 
                                                value={toWalletId}
                                                onChange={e => setToWalletId(e.target.value)}
                                                className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium appearance-none"
                                            >
                                                <option value="">Select Wallet</option>
                                                {wallets.filter(w => w.id !== walletId).map(w => (
                                                    <option key={w.id} value={w.id}>{w.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">Category</label>
                                            <select 
                                                value={category}
                                                onChange={e => setCategory(e.target.value)}
                                                className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium appearance-none"
                                            >
                                                <option value="">Uncategorized</option>
                                                {budgetConfig.rules?.map(r => (
                                                    <option key={r.id} value={r.id}>{r.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">Date</label>
                            <input 
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium"
                            />
                        </div>
                    </div>

                    <div className="p-6 border-t border-border shrink-0 bg-surface">
                        <button 
                            onClick={handleSave}
                            disabled={!amount || (transactionType !== 'saving' && !description) || (transactionType !== 'saving' && !walletId) || (transactionType === 'transfer' && !toWalletId) || (transactionType === 'saving' && !savingGoalId)}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Check className="w-5 h-5" />
                            Save {transactionType.charAt(0).toUpperCase() + transactionType.slice(1)}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AddExpenseModal;
