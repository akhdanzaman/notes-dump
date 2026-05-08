import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Wallet, Tag, Calendar, DollarSign } from 'lucide-react';
import { BudgetConfig, Wallet as WalletType, BrainDumpItem } from '../types';
import { responsiveModal } from './layout/contentSurface';
import { getDefaultInvestmentUnitPrice, resolveInvestmentFundingInput } from '../utils/investmentFunding';

interface AddExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (amount: number, description: string, category: string, walletId: string, date: string, type: 'expense' | 'income' | 'transfer' | 'saving', toWalletId?: string, savingGoalId?: string, savingGoalName?: string, investmentUnits?: number, investmentUnitPrice?: number) => void;
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
    const [investmentUnits, setInvestmentUnits] = useState('');
    const [investmentUnitPrice, setInvestmentUnitPrice] = useState('');

    const selectedSavingGoal = transactionType === 'saving' ? savingGoals.find(g => g.id === savingGoalId) : undefined;
    const isInvestmentTarget = selectedSavingGoal?.meta.shoppingCategory === 'investment';
    const resolvedInvestmentFunding = resolveInvestmentFundingInput({
        investedCapital: amount ? Number(amount) : undefined,
        units: investmentUnits ? Number(investmentUnits) : undefined,
        unitPrice: investmentUnitPrice ? Number(investmentUnitPrice) : undefined,
    });

    const formatInvestmentInputNumber = (value: number) => {
        if (!Number.isFinite(value)) return '';
        return Number.isInteger(value) ? String(value) : value.toFixed(8).replace(/\.?0+$/, '');
    };

    const handleAmountChange = (value: string) => {
        setAmount(value);
        if (!isInvestmentTarget) return;
        const capital = Number(value);
        const price = Number(investmentUnitPrice);
        if (Number.isFinite(capital) && capital > 0 && Number.isFinite(price) && price > 0) {
            setInvestmentUnits(formatInvestmentInputNumber(capital / price));
        }
    };

    const handleInvestmentUnitsChange = (value: string) => {
        setInvestmentUnits(value);
        if (!isInvestmentTarget) return;
        const units = Number(value);
        const price = Number(investmentUnitPrice);
        if (Number.isFinite(units) && units > 0 && Number.isFinite(price) && price > 0) {
            setAmount(formatInvestmentInputNumber(units * price));
        }
    };

    const handleInvestmentUnitPriceChange = (value: string) => {
        setInvestmentUnitPrice(value);
        if (!isInvestmentTarget) return;
        const price = Number(value);
        if (!Number.isFinite(price) || price <= 0) return;
        const capital = Number(amount);
        const units = Number(investmentUnits);
        if ((!investmentUnits || !Number.isFinite(units) || units <= 0) && Number.isFinite(capital) && capital > 0) {
            setInvestmentUnits(formatInvestmentInputNumber(capital / price));
        } else if ((!amount || !Number.isFinite(capital) || capital <= 0) && Number.isFinite(units) && units > 0) {
            setAmount(formatInvestmentInputNumber(units * price));
        }
    };

    const resetInvestmentFundingFields = () => {
        setInvestmentUnits('');
        setInvestmentUnitPrice('');
    };

    const handleSave = () => {
        if (transactionType !== 'saving' && !amount) return;
        if (transactionType === 'saving' && isInvestmentTarget && !resolvedInvestmentFunding.investedCapital) return;
        if (transactionType === 'saving' && !isInvestmentTarget && !amount) return;
        if (transactionType !== 'saving' && !description) return;
        if (transactionType === 'transfer' && (!walletId || !toWalletId)) return;
        if (transactionType === 'saving' && !savingGoalId) return;
        if (transactionType !== 'saving' && transactionType !== 'transfer' && !walletId) return;

        const goal = selectedSavingGoal;
        if (transactionType === 'saving' && isInvestmentTarget && (!walletId || !toWalletId)) return;
        const goalName = goal ? goal.content : '';
        const finalWalletId = transactionType === 'saving' && !isInvestmentTarget ? (goal?.meta.dedicatedWalletId || walletId) : walletId;
        const finalToWalletId = transactionType === 'saving' && isInvestmentTarget ? toWalletId : toWalletId;
        const finalDescription = transactionType === 'saving' ? (isInvestmentTarget ? `Invested into: ${goalName}` : `Saved for: ${goalName}`) : description;
        const finalAmount = isInvestmentTarget ? resolvedInvestmentFunding.investedCapital : parseFloat(amount);
        if (!finalAmount) return;

        onSave(finalAmount, finalDescription, category, finalWalletId, date, transactionType, finalToWalletId, savingGoalId, goalName, isInvestmentTarget ? resolvedInvestmentFunding.units : undefined, isInvestmentTarget ? resolvedInvestmentFunding.unitPrice : undefined);
        setAmount('');
        setDescription('');
        setCategory('');
        setWalletId('');
        setToWalletId('');
        setSavingGoalId('');
        resetInvestmentFundingFields();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className={responsiveModal.sheetOverlay}>
                <motion.div 
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    className={`${responsiveModal.denseFormPanel} max-h-[90vh]`}
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
                            <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">{isInvestmentTarget ? 'Invested Capital' : 'Amount'}</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold">Rp</span>
                                <input 
                                    type="number"
                                    autoFocus
                                    value={amount}
                                    onChange={e => handleAmountChange(e.target.value)}
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
                                                resetInvestmentFundingFields();
                                                if (goal?.meta.shoppingCategory === 'investment') {
                                                    const defaultUnitPrice = getDefaultInvestmentUnitPrice(goal);
                                                    setToWalletId(goal.meta.dedicatedWalletId || '');
                                                    setWalletId('');
                                                    setInvestmentUnitPrice(defaultUnitPrice?.toString() || '');
                                                    if (amount && defaultUnitPrice) {
                                                        setInvestmentUnits(formatInvestmentInputNumber(Number(amount) / defaultUnitPrice));
                                                    }
                                                } else if (goal?.meta.dedicatedWalletId) {
                                                    setWalletId(goal.meta.dedicatedWalletId);
                                                    setToWalletId('');
                                                } else {
                                                    setToWalletId('');
                                                }
                                            }}
                                            className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium appearance-none"
                                        >
                                            <option value="">Select Goal / Investment</option>
                                            {savingGoals.map(g => (
                                                <option key={g.id} value={g.id}>{g.meta.shoppingCategory === 'investment' ? '📈 ' : '🎯 '}{g.content}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">{savingGoals.find(g => g.id === savingGoalId)?.meta.shoppingCategory === 'investment' ? 'From Wallet' : 'Wallet'}</label>
                                        {(() => {
                                            const goal = savingGoals.find(g => g.id === savingGoalId);
                                            if (goal?.meta.shoppingCategory === 'investment') {
                                                return (
                                                    <select
                                                        value={walletId}
                                                        onChange={e => setWalletId(e.target.value)}
                                                        className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium appearance-none"
                                                    >
                                                        <option value="">Select Source Wallet</option>
                                                        {wallets.filter(w => w.id !== goal.meta.dedicatedWalletId).map(w => (
                                                            <option key={w.id} value={w.id}>{w.name}</option>
                                                        ))}
                                                    </select>
                                                );
                                            }
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
                                    {isInvestmentTarget && (
                                        <>
                                            <div className="col-span-2">
                                                <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">To Investment Wallet</label>
                                                <div className="w-full bg-background border border-border rounded-2xl p-4 text-muted font-medium flex items-center gap-2">
                                                    <Wallet className="w-4 h-4" />
                                                    {wallets.find(w => w.id === toWalletId)?.name || 'No linked investment wallet'}
                                                </div>
                                                <p className="text-[10px] text-muted mt-1">Investment savings are treated as a wallet transfer into the platform, so the source wallet balance decreases and the investment wallet increases.</p>
                                            </div>
                                            <div className="col-span-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                                                <div>
                                                    <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Auto-fill units or capital</div>
                                                    <p className="text-[10px] text-muted mt-1">Isi invested capital atau units. Kalau ada buy price, field satunya otomatis keisi dan units akan ditambahkan ke investment.</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">Units bought</label>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            value={investmentUnits}
                                                            onChange={e => handleInvestmentUnitsChange(e.target.value)}
                                                            placeholder="Optional"
                                                            className="w-full bg-background border border-border rounded-xl p-3 text-sm text-primary focus:outline-none focus:border-emerald-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-muted mb-1 uppercase tracking-wider">Buy price / unit</label>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            value={investmentUnitPrice}
                                                            onChange={e => handleInvestmentUnitPriceChange(e.target.value)}
                                                            placeholder="Optional"
                                                            className="w-full bg-background border border-border rounded-xl p-3 text-sm text-primary focus:outline-none focus:border-emerald-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
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
                            disabled={!(transactionType === 'saving' && isInvestmentTarget ? resolvedInvestmentFunding.investedCapital : amount) || (transactionType !== 'saving' && !description) || (transactionType !== 'saving' && !walletId) || (transactionType === 'transfer' && !toWalletId) || (transactionType === 'saving' && !savingGoalId) || (transactionType === 'saving' && isInvestmentTarget && (!walletId || !toWalletId))}
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
