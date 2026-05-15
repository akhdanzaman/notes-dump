import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Wallet, DollarSign } from 'lucide-react';
import { BudgetConfig, Wallet as WalletType, BrainDumpItem } from '../types';
import { addItemModal, addItemModalMotion, responsiveModal } from './layout/contentSurface';
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
                    initial={addItemModalMotion.initial}
                    animate={addItemModalMotion.animate}
                    exit={addItemModalMotion.exit}
                    transition={addItemModalMotion.transition}
                    className={addItemModal.panel}
                >
                    <div className={addItemModal.header}>
                        <h3 className={addItemModal.title}>
                            <DollarSign className={`w-5 h-5 ${transactionType === 'expense' ? 'text-red-500' : transactionType === 'income' ? 'text-green-500' : 'text-indigo-500'}`} />
                            {transactionType.charAt(0).toUpperCase() + transactionType.slice(1)}
                        </h3>
                        <button onClick={onClose} className={addItemModal.closeButton}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className={addItemModal.body}>
                        <div className={addItemModal.tabGroup}>
                            {(['expense', 'income', 'transfer', 'saving'] as const).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setTransactionType(type)}
                                    className={addItemModal.tabButton(transactionType === type)}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>

                        <div>
                            <label className={addItemModal.label}>{isInvestmentTarget ? 'Invested Capital' : 'Amount'}</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold">Rp</span>
                                <input 
                                    type="number"
                                    autoFocus
                                    value={amount}
                                    onChange={e => handleAmountChange(e.target.value)}
                                    placeholder="0"
                                    className={`${addItemModal.titleInput} pl-12`}
                                />
                            </div>
                        </div>

                        {transactionType !== 'saving' && (
                            <div>
                                <label className={addItemModal.label}>Description</label>
                                <input 
                                    type="text"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder={transactionType === 'expense' ? "What did you buy?" : transactionType === 'income' ? "Source of income?" : "Description"}
                                    className={addItemModal.input}
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            {transactionType === 'saving' ? (
                                <>
                                    <div className="col-span-2">
                                        <label className={addItemModal.label}>Saving Goal</label>
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
                                            className={addItemModal.select}
                                        >
                                            <option value="">Select Goal / Investment</option>
                                            {savingGoals.map(g => (
                                                <option key={g.id} value={g.id}>{g.meta.shoppingCategory === 'investment' ? '📈 ' : '🎯 '}{g.content}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className={addItemModal.label}>{savingGoals.find(g => g.id === savingGoalId)?.meta.shoppingCategory === 'investment' ? 'From Wallet' : 'Wallet'}</label>
                                        {(() => {
                                            const goal = savingGoals.find(g => g.id === savingGoalId);
                                            if (goal?.meta.shoppingCategory === 'investment') {
                                                return (
                                                    <select
                                                        value={walletId}
                                                        onChange={e => setWalletId(e.target.value)}
                                                        className={addItemModal.select}
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
                                                    <div className={addItemModal.readonlyField}>
                                                        <Wallet className="w-4 h-4" />
                                                        {wallet ? wallet.name : 'Linked to Goal'}
                                                    </div>
                                                );
                                            } else {
                                                return (
                                                    <select 
                                                        value={walletId}
                                                        onChange={e => setWalletId(e.target.value)}
                                                        className={addItemModal.select}
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
                                                <label className={addItemModal.label}>To Investment Wallet</label>
                                                <div className={addItemModal.readonlyField}>
                                                    <Wallet className="w-4 h-4" />
                                                    {wallets.find(w => w.id === toWalletId)?.name || 'No linked investment wallet'}
                                                </div>
                                                <p className={addItemModal.helpText}>Investment savings are treated as a wallet transfer into the platform, so the source wallet balance decreases and the investment wallet increases.</p>
                                            </div>
                                            <div className={`col-span-2 ${addItemModal.accentPanel}`}>
                                                <div>
                                                    <div className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Auto-fill units or capital</div>
                                                    <p className={addItemModal.helpText}>Isi invested capital atau units. Kalau ada buy price, field satunya otomatis keisi dan units akan ditambahkan ke investment.</p>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className={addItemModal.label}>Units bought</label>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            value={investmentUnits}
                                                            onChange={e => handleInvestmentUnitsChange(e.target.value)}
                                                            placeholder="Optional"
                                                            className={`${addItemModal.smallInput} focus:border-emerald-500`}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className={addItemModal.label}>Buy price / unit</label>
                                                        <input
                                                            type="number"
                                                            step="any"
                                                            value={investmentUnitPrice}
                                                            onChange={e => handleInvestmentUnitPriceChange(e.target.value)}
                                                            placeholder="Optional"
                                                            className={`${addItemModal.smallInput} focus:border-emerald-500`}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                    <div className="col-span-2">
                                        <label className={addItemModal.label}>Category</label>
                                        <select 
                                            value={category}
                                            onChange={e => setCategory(e.target.value)}
                                            className={addItemModal.select}
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
                                        <label className={addItemModal.label}>{transactionType === 'transfer' ? 'From' : 'Wallet'}</label>
                                        <select 
                                            value={walletId}
                                            onChange={e => setWalletId(e.target.value)}
                                            className={addItemModal.select}
                                        >
                                            <option value="">Select Wallet</option>
                                            {wallets.map(w => (
                                                <option key={w.id} value={w.id}>{w.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {transactionType === 'transfer' ? (
                                        <div>
                                            <label className={addItemModal.label}>To</label>
                                            <select 
                                                value={toWalletId}
                                                onChange={e => setToWalletId(e.target.value)}
                                                className={addItemModal.select}
                                            >
                                                <option value="">Select Wallet</option>
                                                {wallets.filter(w => w.id !== walletId).map(w => (
                                                    <option key={w.id} value={w.id}>{w.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <div>
                                            <label className={addItemModal.label}>Category</label>
                                            <select 
                                                value={category}
                                                onChange={e => setCategory(e.target.value)}
                                                className={addItemModal.select}
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
                            <label className={addItemModal.label}>Date</label>
                            <input 
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className={addItemModal.input}
                            />
                        </div>
                    </div>

                    <div className={addItemModal.footer}>
                        <button 
                            onClick={handleSave}
                            disabled={!(transactionType === 'saving' && isInvestmentTarget ? resolvedInvestmentFunding.investedCapital : amount) || (transactionType !== 'saving' && !description) || (transactionType !== 'saving' && !walletId) || (transactionType === 'transfer' && !toWalletId) || (transactionType === 'saving' && !savingGoalId) || (transactionType === 'saving' && isInvestmentTarget && (!walletId || !toWalletId))}
                            className={addItemModal.primaryButton}
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
