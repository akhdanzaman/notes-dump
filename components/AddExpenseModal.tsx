import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Wallet, Tag, Calendar, DollarSign } from 'lucide-react';
import { BudgetConfig, Wallet as WalletType } from '../types';

interface AddExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (amount: number, description: string, category: string, walletId: string, date: string) => void;
    wallets: WalletType[];
    budgetConfig: BudgetConfig;
}

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ isOpen, onClose, onSave, wallets, budgetConfig }) => {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [walletId, setWalletId] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const handleSave = () => {
        if (!amount || !description || !walletId) return;
        onSave(parseFloat(amount), description, category, walletId, date);
        setAmount('');
        setDescription('');
        setCategory('');
        setWalletId('');
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
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-[32px] sm:rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center shrink-0">
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-red-500" />
                            Add Expense
                        </h3>
                        <button onClick={onClose} className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full text-zinc-500 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto">
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">Amount</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">Rp</span>
                                <input 
                                    type="number"
                                    autoFocus
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 pl-12 text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 font-bold text-lg"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">Description</label>
                            <input 
                                type="text"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="What did you buy?"
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">Wallet</label>
                                <select 
                                    value={walletId}
                                    onChange={e => setWalletId(e.target.value)}
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium appearance-none"
                                >
                                    <option value="">Select Wallet</option>
                                    {wallets.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">Category</label>
                                <select 
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium appearance-none"
                                >
                                    <option value="">Uncategorized</option>
                                    {budgetConfig.rules.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">Date</label>
                            <input 
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
                            />
                        </div>
                    </div>

                    <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-900">
                        <button 
                            onClick={handleSave}
                            disabled={!amount || !description || !walletId}
                            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <Check className="w-5 h-5" />
                            Save Expense
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default AddExpenseModal;
