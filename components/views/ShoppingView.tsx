import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainDumpItem, FinanceType, ShoppingCategory, BudgetRule, Wallet, Tab } from '../../types';
import { getShoppingItems } from '../../utils/selectors';
import ShoppingItem from '../ShoppingItem';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';

import { Plus, ShoppingCart, PiggyBank, Target, Wallet as WalletIcon, Calendar, Check, X, ChevronDown, ChevronUp, Trash2, Pencil, Save } from 'lucide-react';
import { ItemType } from '../../types';

interface ShoppingViewProps {
    items: BrainDumpItem[];
    handleToggleStatus: (id: string) => void;
    handleDelete: (id: string) => void;
    handleUpdateItem: (
        id: string, 
        newContent: string, 
        newTags: string[], 
        newAmount?: number, 
        newDate?: string, 
        newPaymentMethod?: string, 
        newBudgetCategory?: string, 
        newDuration?: number, 
        newSkillId?: string, 
        newToWallet?: string, 
        newFinanceType?: FinanceType, 
        newProgress?: number, 
        newProgressNotes?: string,
        newShoppingCategory?: ShoppingCategory,
        newRecurrenceDays?: number,
        newQuantity?: string,
        newIsRoutine?: boolean,
        newRoutineInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly',
        newRoutineDaysOfWeek?: number[],
        newRoutineDaysOfMonth?: number[],
        newRoutineMonthsOfYear?: number[],
        newSavingGoalId?: string,
        newDedicatedWalletId?: string
    ) => void;
    budgetRules: BudgetRule[];
    handleResetRoutine: (id: string) => void;
    handleOpenAddShopping: (category: ShoppingCategory) => void;
    shoppingSubTab: 'shopping' | 'savings';
    setShoppingSubTab: (tab: 'shopping' | 'savings') => void;
    wallets: Wallet[];
    onAddFunds: (amount: number, walletId: string, date: string, goalId: string, goalName: string) => void;
    onCompleteGoal: (goal: BrainDumpItem) => void;
    setActiveTab: (tab: Tab) => void;
}

const ShoppingView: React.FC<ShoppingViewProps> = ({
    items, handleToggleStatus, handleDelete, handleUpdateItem, budgetRules, handleResetRoutine, handleOpenAddShopping,
    shoppingSubTab, setShoppingSubTab, wallets, onAddFunds, onCompleteGoal, setActiveTab
}) => {
    
    const { urgent, routine, normal, savings } = getShoppingItems(items);
    const isEmpty = urgent.length === 0 && routine.length === 0 && normal.length === 0;

    const [addFundsModal, setAddFundsModal] = useState<{ isOpen: boolean, goalId: string, goalName: string, defaultWallet?: string } | null>(null);
    const [fundAmount, setFundAmount] = useState('');
    const [fundWallet, setFundWallet] = useState('');
    const [fundDate, setFundDate] = useState(new Date().toISOString().split('T')[0]);

    // Main Tab Swipe Logic
    const swipeHandlers = useSwipeTabs('shopping', setActiveTab);

    // Sub-Tab Swipe State
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartRef = React.useRef<{ x: number, y: number } | null>(null);
    const isHorizontalSwipe = React.useRef<boolean | null>(null);

    const tabs: ('shopping' | 'savings')[] = ['shopping', 'savings'];
    const activeIndex = tabs.indexOf(shoppingSubTab);

    const onTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setIsDragging(true);
        isHorizontalSwipe.current = null;
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        
        const dx = e.touches[0].clientX - touchStartRef.current.x;
        const dy = e.touches[0].clientY - touchStartRef.current.y;

        if (isHorizontalSwipe.current === null) {
             if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5) {
                 isHorizontalSwipe.current = true;
             } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 5) {
                 isHorizontalSwipe.current = false;
             }
        }

        if (isHorizontalSwipe.current) {
            // Resistance
            if ((activeIndex === 0 && dx > 0) || (activeIndex === tabs.length - 1 && dx < 0)) {
                setDragOffset(dx * 0.3);
            } else {
                setDragOffset(dx);
            }
        }
    };

    const onTouchEnd = () => {
        setIsDragging(false);
        const threshold = window.innerWidth * 0.25;

        if (isHorizontalSwipe.current && Math.abs(dragOffset) > threshold) {
            if (dragOffset < 0 && activeIndex < tabs.length - 1) {
                setShoppingSubTab(tabs[activeIndex + 1]);
            }
            if (dragOffset > 0 && activeIndex > 0) {
                setShoppingSubTab(tabs[activeIndex - 1]);
            }
        }
        
        setDragOffset(0);
        touchStartRef.current = null;
        isHorizontalSwipe.current = null;
    };

    const handleSaveFunds = () => {
        if (!addFundsModal || !fundAmount || !fundWallet) return;
        onAddFunds(Number(fundAmount), fundWallet, new Date(fundDate).toISOString(), addFundsModal.goalId, addFundsModal.goalName);
        setAddFundsModal(null);
        setFundAmount('');
        setFundWallet('');
        setFundDate(new Date().toISOString().split('T')[0]);
    };

    const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState('');
    const [editAmount, setEditAmount] = useState('');
    const [editDate, setEditDate] = useState('');
    const [editDedicatedWalletId, setEditDedicatedWalletId] = useState('');

    const handleSaveEdit = (goal: BrainDumpItem) => {
        handleUpdateItem(
            goal.id,
            editContent,
            goal.meta.tags || [],
            Number(editAmount),
            new Date(editDate).toISOString(),
            goal.meta.paymentMethod,
            goal.meta.budgetCategory,
            goal.meta.durationMinutes,
            goal.meta.skillId,
            goal.meta.toWallet,
            'saving',
            goal.meta.progress,
            goal.meta.progressNotes,
            goal.meta.shoppingCategory,
            goal.meta.recurrenceDays,
            goal.meta.quantity,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            editDedicatedWalletId
        );
        setExpandedGoalId(null);
    };

    const renderGoalCard = (goal: BrainDumpItem) => {
        const target = goal.meta.amount || 0;
        const saved = goal.meta.savedAmount || 0;
        const progress = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
        const isDone = goal.status === 'done';
        const isExpanded = expandedGoalId === goal.id;
        
        const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

        return (
            <motion.div 
                layout={!isDragging}
                transition={{ type: "tween", duration: 0.3 }}
                key={goal.id} 
                className={`bg-surface border border-border rounded-[24px] overflow-hidden ${isDone ? 'opacity-60' : ''}`}
            >
                <div 
                    className="p-5 cursor-pointer"
                    onClick={() => {
                        if (isExpanded) {
                            setExpandedGoalId(null);
                        } else {
                            setExpandedGoalId(goal.id);
                            setEditContent(goal.content);
                            setEditAmount(goal.meta.amount?.toString() || '');
                            setEditDate(goal.meta.date ? goal.meta.date.split('T')[0] : new Date().toISOString().split('T')[0]);
                            setEditDedicatedWalletId(goal.meta.dedicatedWalletId || '');
                        }
                    }}
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                            <h4 className="font-bold text-lg text-primary mb-1">{goal.content}</h4>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                                {goal.meta.dedicatedWalletId && (
                                    <p className="text-xs text-muted flex items-center gap-1">
                                        <WalletIcon className="w-3 h-3" />
                                        {wallets.find(w => w.id === goal.meta.dedicatedWalletId)?.name || 'Unknown Wallet'}
                                    </p>
                                )}
                                {goal.meta.date && (
                                    <p className="text-xs text-muted flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        Target: {new Date(goal.meta.date).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="text-right ml-4">
                             <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Progress</p>
                             <p className="text-lg font-bold text-primary">
                                <span className="text-indigo-500">{fmt(saved)}</span>
                                <span className="text-muted mx-1">/</span>
                                <span>{fmt(target)}</span>
                             </p>
                        </div>
                    </div>

                    <div className="mb-2 flex justify-between items-end">
                        <div className="flex-1">
                            {!isDone && (
                                <div className="flex gap-2 mb-2">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setAddFundsModal({
                                                isOpen: true,
                                                goalId: goal.id,
                                                goalName: goal.content,
                                                defaultWallet: goal.meta.dedicatedWalletId
                                            });
                                            setFundWallet(goal.meta.dedicatedWalletId || '');
                                        }}
                                        className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 rounded-xl text-[10px] font-bold transition-colors flex items-center gap-1.5"
                                    >
                                        <Plus className="w-3 h-3" /> Add Funds
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCompleteGoal(goal);
                                        }}
                                        className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 rounded-xl text-[10px] font-bold transition-colors flex items-center gap-1.5"
                                    >
                                        <Check className="w-3 h-3" /> Complete
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="text-right">
                            <p className="text-sm font-bold text-primary">{Math.round(progress)}%</p>
                        </div>
                    </div>

                    <div className="h-2 bg-muted/10 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-border bg-muted/5 px-5 pb-5 pt-4 space-y-4"
                        >
                            <div className="space-y-3 p-3 bg-background border border-border rounded-2xl shadow-sm">
                                <div>
                                    <label className="block text-[10px] font-bold text-muted mb-1 uppercase tracking-wider">Goal Name</label>
                                    <input 
                                        type="text"
                                        value={editContent}
                                        onChange={e => setEditContent(e.target.value)}
                                        className="w-full bg-muted/10 border border-border rounded-xl p-2 text-sm text-primary focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-muted mb-1 uppercase tracking-wider">Target Amount</label>
                                        <input 
                                            type="number"
                                            value={editAmount}
                                            onChange={e => setEditAmount(e.target.value)}
                                            className="w-full bg-muted/10 border border-border rounded-xl p-2 text-sm text-primary focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-muted mb-1 uppercase tracking-wider">Target Date</label>
                                        <input 
                                            type="date"
                                            value={editDate}
                                            onChange={e => setEditDate(e.target.value)}
                                            className="w-full bg-muted/10 border border-border rounded-xl p-2 text-sm text-primary focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-muted mb-1 uppercase tracking-wider">Dedicated Wallet</label>
                                    <select 
                                        value={editDedicatedWalletId}
                                        onChange={e => setEditDedicatedWalletId(e.target.value)}
                                        className="w-full bg-muted/10 border border-border rounded-xl p-2 text-sm text-primary focus:outline-none focus:border-indigo-500 appearance-none"
                                    >
                                        <option value="">Select Wallet</option>
                                        {wallets.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleSaveEdit(goal); }}
                                        className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 transition-colors"
                                    >
                                        <Save className="w-3 h-3" /> Save Changes
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setExpandedGoalId(null); }}
                                        className="px-4 py-2 bg-muted/10 text-muted rounded-xl text-xs font-bold hover:bg-muted/20 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>

                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Delete this goal?')) handleDelete(goal.id);
                                }}
                                className="w-full py-2 text-red-500 hover:bg-red-500/10 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-3 h-3" /> Delete Goal
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    };

    const renderGroup = (title: string, list: BrainDumpItem[], colorClass: string, category: ShoppingCategory) => {
        // Always render the group header so the user can add items, even if empty
        return (
            <div className="mb-6">
                <div className="flex items-center justify-between mb-3 pl-1">
                    <h3 className={`text-sm font-bold ${colorClass} uppercase tracking-wider`}>{title}</h3>
                    <button 
                        onClick={() => handleOpenAddShopping(category)}
                        className={`p-1 hover:bg-black/5 dark:hover:bg-white/10 ${colorClass} rounded-md transition-colors`}
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                {list.length > 0 ? (
                    <div className="space-y-2">
                        {list.map(item => (
                        <ShoppingItem 
                            key={item.id} 
                            item={item} 
                            onToggleStatus={handleToggleStatus} 
                            onDelete={handleDelete} 
                            handleUpdateItem={handleUpdateItem} 
                            budgetRules={budgetRules}
                            onResetRoutine={handleResetRoutine}
                        />
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-muted italic pl-1 opacity-50">No items</div>
                )}
            </div>
        );
    };

    return (
    <div className="pb-20 min-h-[50vh] overflow-hidden">
        {/* Top Container */}
        <motion.div 
            layoutId="top-container"
            className="bg-white dark:bg-zinc-100 text-black rounded-b-[32px] p-6 pt-12 shadow-sm mb-4 touch-pan-y"
            transition={{ type: "tween", duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            onTouchStart={swipeHandlers.onTouchStart}
            onTouchMove={swipeHandlers.onTouchMove}
            onTouchEnd={swipeHandlers.onTouchEnd}
            style={{ x: swipeHandlers.dragOffset }}
        >
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "linear" }}
            >
                <div className="flex bg-black/5 rounded-2xl p-1 mb-6">
                    <button 
                        onClick={() => setShoppingSubTab('shopping')}
                        className={`flex-1 py-2 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${shoppingSubTab === 'shopping' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-black/40 hover:text-black'}`}
                    >
                        <ShoppingCart className="w-4 h-4" /> Shopping
                    </button>
                    <button 
                        onClick={() => setShoppingSubTab('savings')}
                        className={`flex-1 py-2 text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-colors ${shoppingSubTab === 'savings' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm' : 'text-black/40 hover:text-black'}`}
                    >
                        <PiggyBank className="w-4 h-4" /> Savings
                    </button>
                </div>

                <h1 className="text-3xl font-bold tracking-tight mb-6">
                    {shoppingSubTab === 'shopping' ? 'Shopping' : 'Savings'}
                </h1>

                {shoppingSubTab === 'shopping' ? (
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <p className="text-sm font-bold opacity-60 uppercase tracking-wider mb-1 text-red-600 dark:text-red-500">Urgent</p>
                            <p className="text-3xl font-bold">{urgent.length}</p>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold opacity-60 uppercase tracking-wider mb-1">Routine</p>
                            <p className="text-3xl font-bold">{routine.length}</p>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold opacity-60 uppercase tracking-wider mb-1">Normal</p>
                            <p className="text-3xl font-bold">{normal.length}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <p className="text-sm font-bold opacity-60 uppercase tracking-wider mb-1 text-indigo-600 dark:text-indigo-500">Goals</p>
                            <p className="text-3xl font-bold">{savings.length}</p>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold opacity-60 uppercase tracking-wider mb-1 text-emerald-600 dark:text-emerald-500">Saved</p>
                            <p className="text-xl font-bold mt-1">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(savings.reduce((sum, s) => sum + (s.meta.savedAmount || 0), 0))}
                            </p>
                        </div>
                    </div>
                )}
            </motion.div>
        </motion.div>

        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4, delay: 0.1 } }}
            className="touch-pan-y"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            <motion.div 
                className="flex w-full will-change-transform"
                style={{
                    transform: `translateX(calc(-${activeIndex * 100}% + ${dragOffset}px))`,
                    transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
                }}
            >
                {/* VIEW: Shopping */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full flex-shrink-0 px-4"
                >
                    {isEmpty ? (
                        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-[32px] gap-4">
                            <p className="text-muted font-medium">No life admin tasks.</p>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => handleOpenAddShopping('not_urgent')} 
                                    className="flex items-center gap-2 px-4 py-2 bg-black/5 hover:bg-black/10 text-primary rounded-2xl text-sm font-bold transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Add Item
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {(urgent.length > 0 || !isEmpty) && renderGroup("Urgent", urgent, "text-red-500", "urgent")}
                            {(routine.length > 0 || !isEmpty) && renderGroup("Routine & Maintenance", routine, "text-acc-event", "routine")}
                            {(normal.length > 0 || !isEmpty) && renderGroup("To Do / To Buy", normal, "text-acc-shopping", "not_urgent")}
                        </>
                    )}
                </motion.div>

                {/* VIEW: Savings */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full flex-shrink-0 px-4"
                >
                    <div className="flex items-center justify-between mb-4 pl-1">
                        <h3 className="text-sm font-bold text-indigo-500 uppercase tracking-wider">Saving Goals</h3>
                        <button 
                            onClick={() => handleOpenAddShopping('saving')}
                            className="p-1 hover:bg-indigo-500/10 text-indigo-500 rounded-md transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    {savings.length > 0 ? (
                        <div className="space-y-4">
                            {savings.map(goal => renderGoalCard(goal))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border rounded-[32px] gap-4">
                            <p className="text-muted font-medium">No saving goals yet.</p>
                            <button 
                                onClick={() => handleOpenAddShopping('saving')} 
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-500 rounded-2xl text-sm font-bold transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Create Goal
                            </button>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </motion.div>

        {/* Add Funds Modal */}
        <AnimatePresence>
            {addFundsModal?.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div 
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        className="bg-surface border border-border rounded-t-[32px] sm:rounded-[32px] w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
                    >
                        <div className="p-6 border-b border-border flex justify-between items-center shrink-0">
                            <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                                <PiggyBank className="w-5 h-5 text-indigo-500" />
                                Add Funds
                            </h3>
                            <button onClick={() => setAddFundsModal(null)} className="p-2 bg-muted/10 hover:bg-muted/20 rounded-full text-muted transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-sm font-medium text-muted">Adding funds to: <span className="text-primary font-bold">{addFundsModal.goalName}</span></p>
                            
                            <div>
                                <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">Amount</label>
                                <input 
                                    type="number"
                                    autoFocus
                                    value={fundAmount}
                                    onChange={e => setFundAmount(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium text-2xl"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">From Wallet</label>
                                <select 
                                    value={fundWallet}
                                    onChange={e => setFundWallet(e.target.value)}
                                    className="w-full bg-background border border-border rounded-2xl p-4 text-primary focus:outline-none focus:border-indigo-500 font-medium appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={!!addFundsModal.defaultWallet}
                                >
                                    <option value="">Select Wallet</option>
                                    {wallets.map(w => (
                                        <option key={w.id} value={w.id}>{w.name} ({new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(w.initialBalance)})</option>
                                    ))}
                                </select>
                                {!!addFundsModal.defaultWallet && (
                                    <p className="text-xs text-muted mt-2">Locked to dedicated wallet for this goal.</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-muted mb-2 uppercase tracking-wider">Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                    <input 
                                        type="date"
                                        value={fundDate}
                                        onChange={e => setFundDate(e.target.value)}
                                        className="w-full bg-background border border-border rounded-2xl pl-12 pr-4 py-4 text-primary focus:outline-none focus:border-indigo-500 font-medium"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-border shrink-0">
                            <button 
                                onClick={handleSaveFunds}
                                disabled={!fundAmount || !fundWallet}
                                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <Plus className="w-5 h-5" />
                                Add Funds
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    </div>
    );
};

export default ShoppingView;