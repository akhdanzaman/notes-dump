import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Check,
  Wallet,
  DollarSign,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  BudgetConfig,
  Wallet as WalletType,
  BrainDumpItem,
  TransactionLineItem,
  ReceiptCaptureMeta,
} from '../types';
import { addItemModal, addItemModalMotion, responsiveModal } from './layout/contentSurface';
import { getDefaultInvestmentUnitPrice, resolveInvestmentFundingInput } from '../utils/investmentFunding';
import { sanitizeTransactionLineItems, sumTransactionLineItems } from '../utils/transactionLineItems';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    amount: number,
    description: string,
    category: string,
    walletId: string,
    date: string,
    type: 'expense' | 'income' | 'transfer' | 'saving',
    toWalletId?: string,
    savingGoalId?: string,
    savingGoalName?: string,
    investmentUnits?: number,
    investmentUnitPrice?: number,
    transactionLineItems?: TransactionLineItem[],
    merchant?: string,
    receiptCapture?: ReceiptCaptureMeta,
  ) => void;
  wallets: WalletType[];
  budgetConfig: BudgetConfig;
  savingGoals: BrainDumpItem[];
}

const todayInputValue = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const createBlankLineItem = (): TransactionLineItem => ({
  id: `manual-line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  amount: 0,
  kind: 'item',
});

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  wallets,
  budgetConfig,
  savingGoals,
}) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('');
  const [walletId, setWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [savingGoalId, setSavingGoalId] = useState('');
  const [date, setDate] = useState(todayInputValue());
  const [transactionType, setTransactionType] = useState<'expense' | 'income' | 'transfer' | 'saving'>('expense');
  const [investmentUnits, setInvestmentUnits] = useState('');
  const [investmentUnitPrice, setInvestmentUnitPrice] = useState('');
  const [transactionLineItems, setTransactionLineItems] = useState<TransactionLineItem[]>([]);

  const selectedSavingGoal = transactionType === 'saving'
    ? savingGoals.find((goal) => goal.id === savingGoalId)
    : undefined;
  const isInvestmentTarget = selectedSavingGoal?.meta.shoppingCategory === 'investment';
  const resolvedInvestmentFunding = resolveInvestmentFundingInput({
    investedCapital: amount ? Number(amount) : undefined,
    units: investmentUnits ? Number(investmentUnits) : undefined,
    unitPrice: investmentUnitPrice ? Number(investmentUnitPrice) : undefined,
  });

  const sanitizedLineItems = useMemo(
    () => sanitizeTransactionLineItems(transactionLineItems),
    [transactionLineItems],
  );
  const lineItemsTotal = useMemo(
    () => sumTransactionLineItems(sanitizedLineItems),
    [sanitizedLineItems],
  );
  const hasLineItems = transactionType === 'expense' && sanitizedLineItems.length > 0;

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

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setMerchant('');
    setCategory('');
    setWalletId('');
    setToWalletId('');
    setSavingGoalId('');
    setDate(todayInputValue());
    setInvestmentUnits('');
    setInvestmentUnitPrice('');
    setTransactionLineItems([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const updateLineItem = (id: string, patch: Partial<TransactionLineItem>) => {
    setTransactionLineItems((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  };

  const removeLineItem = (id: string) => {
    setTransactionLineItems((current) => current.filter((line) => line.id !== id));
  };

  const handleSave = () => {
    const goal = selectedSavingGoal;
    const goalName = goal?.content || '';
    const finalWalletId = transactionType === 'saving' && !isInvestmentTarget
      ? (goal?.meta.dedicatedWalletId || walletId)
      : walletId;
    const finalToWalletId = transactionType === 'saving' && isInvestmentTarget ? toWalletId : toWalletId;
    const finalDescription = transactionType === 'saving'
      ? (isInvestmentTarget ? `Invested into: ${goalName}` : `Saved for: ${goalName}`)
      : description.trim();
    const finalAmount = transactionType === 'expense' && sanitizedLineItems.length
      ? lineItemsTotal
      : isInvestmentTarget
        ? resolvedInvestmentFunding.investedCapital
        : Number(amount);

    if (!finalAmount || finalAmount <= 0) return;
    if (transactionType !== 'saving' && !finalDescription) return;
    if (transactionType === 'transfer' && (!walletId || !toWalletId)) return;
    if (transactionType === 'saving' && !savingGoalId) return;
    if (transactionType !== 'saving' && transactionType !== 'transfer' && !walletId) return;
    if (transactionType === 'saving' && isInvestmentTarget && (!walletId || !toWalletId)) return;

    onSave(
      finalAmount,
      finalDescription,
      category,
      finalWalletId,
      date,
      transactionType,
      finalToWalletId,
      savingGoalId,
      goalName,
      isInvestmentTarget ? resolvedInvestmentFunding.units : undefined,
      isInvestmentTarget ? resolvedInvestmentFunding.unitPrice : undefined,
      transactionType === 'expense' && sanitizedLineItems.length ? sanitizedLineItems : undefined,
      merchant.trim() || undefined,
      undefined,
    );
    resetForm();
    onClose();
  };

  const effectiveAmount = transactionType === 'expense' && sanitizedLineItems.length
    ? lineItemsTotal
    : isInvestmentTarget
      ? resolvedInvestmentFunding.investedCapital || 0
      : Number(amount) || 0;
  const canSave = effectiveAmount > 0
    && (transactionType === 'saving' || !!description.trim())
    && (transactionType === 'saving' || transactionType === 'transfer' || !!walletId)
    && (transactionType !== 'transfer' || (!!walletId && !!toWalletId))
    && (transactionType !== 'saving' || !!savingGoalId)
    && !(transactionType === 'saving' && isInvestmentTarget && (!walletId || !toWalletId));

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
            <button onClick={handleClose} className={addItemModal.closeButton}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className={addItemModal.body}>
            <div className={addItemModal.tabGroup}>
              {(['expense', 'income', 'transfer', 'saving'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
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
                  value={hasLineItems ? String(lineItemsTotal) : amount}
                  onChange={(event) => handleAmountChange(event.target.value)}
                  readOnly={hasLineItems}
                  placeholder="0"
                  className={`${addItemModal.titleInput} pl-12 ${hasLineItems ? 'opacity-70' : ''}`}
                />
              </div>
              {hasLineItems && <p className={addItemModal.helpText}>Total dihitung otomatis dari semua line item.</p>}
            </div>

            {transactionType !== 'saving' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={transactionType === 'transfer' ? 'sm:col-span-2' : ''}>
                  <label className={addItemModal.label}>Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={transactionType === 'expense' ? 'Nama transaksi / ringkasan nota' : transactionType === 'income' ? 'Source of income?' : 'Description'}
                    className={addItemModal.input}
                  />
                </div>
                {transactionType === 'expense' && (
                  <div>
                    <label className={addItemModal.label}>Merchant</label>
                    <input
                      type="text"
                      value={merchant}
                      onChange={(event) => setMerchant(event.target.value)}
                      placeholder="Optional"
                      className={addItemModal.input}
                    />
                  </div>
                )}
              </div>
            )}

            {transactionType === 'expense' && (
              <section className={addItemModal.sectionPanel}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className={addItemModal.sectionTitle}>Line items</div>
                    <p className="text-xs text-muted -mt-2">Satu nota tetap satu transaksi. Kategori budget dapat berbeda per item.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTransactionLineItems((current) => [...current, createBlankLineItem()])}
                    className="rounded-xl border border-border px-3 py-2 text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Item
                  </button>
                </div>

                {transactionLineItems.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setTransactionLineItems([createBlankLineItem()])}
                    className="w-full rounded-xl border border-dashed border-border py-4 text-sm text-muted"
                  >
                    Tambahkan line item manual
                  </button>
                ) : (
                  <div className="space-y-3">
                    {transactionLineItems.map((line, index) => (
                      <div key={line.id} className="rounded-2xl border border-border p-3 space-y-3 bg-background/40">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted w-6">{index + 1}.</span>
                          <input
                            value={line.name}
                            onChange={(event) => updateLineItem(line.id, { name: event.target.value })}
                            placeholder="Nama item"
                            className={`${addItemModal.smallInput} flex-1`}
                          />
                          <button type="button" onClick={() => removeLineItem(line.id)} className="p-2 text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <input
                            value={line.quantity || ''}
                            onChange={(event) => updateLineItem(line.id, { quantity: event.target.value || undefined })}
                            placeholder="Qty"
                            className={addItemModal.smallInput}
                          />
                          <input
                            type="number"
                            value={line.unitPrice ?? ''}
                            onChange={(event) => updateLineItem(line.id, { unitPrice: event.target.value ? Number(event.target.value) : undefined })}
                            placeholder="Harga/unit"
                            className={addItemModal.smallInput}
                          />
                          <input
                            type="number"
                            value={line.amount || ''}
                            onChange={(event) => updateLineItem(line.id, { amount: Number(event.target.value) || 0 })}
                            placeholder="Total item"
                            className={addItemModal.smallInput}
                          />
                          <select
                            value={line.budgetCategory || ''}
                            onChange={(event) => updateLineItem(line.id, { budgetCategory: event.target.value || undefined })}
                            className={addItemModal.smallInput}
                          >
                            <option value="">Pakai default</option>
                            {budgetConfig.rules?.map((rule) => (
                              <option key={rule.id} value={rule.id}>{rule.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span>Total line items</span>
                      <span>Rp {lineItemsTotal.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                )}
              </section>
            )}

            <div className="grid grid-cols-2 gap-4">
              {transactionType === 'saving' ? (
                <>
                  <div className="col-span-2">
                    <label className={addItemModal.label}>Saving Goal</label>
                    <select
                      value={savingGoalId}
                      onChange={(event) => {
                        const nextGoalId = event.target.value;
                        setSavingGoalId(nextGoalId);
                        const goal = savingGoals.find((candidate) => candidate.id === nextGoalId);
                        if (goal?.meta.shoppingCategory === 'investment') {
                          setToWalletId(goal.meta.dedicatedWalletId || '');
                          setWalletId('');
                          const defaultPrice = getDefaultInvestmentUnitPrice(goal);
                          setInvestmentUnitPrice(defaultPrice ? formatInvestmentInputNumber(defaultPrice) : '');
                        } else if (goal?.meta.dedicatedWalletId) {
                          setWalletId(goal.meta.dedicatedWalletId);
                          setToWalletId('');
                          setInvestmentUnits('');
                          setInvestmentUnitPrice('');
                        } else {
                          setToWalletId('');
                          setInvestmentUnits('');
                          setInvestmentUnitPrice('');
                        }
                      }}
                      className={addItemModal.select}
                    >
                      <option value="">Select Goal / Investment</option>
                      {savingGoals.map((goal) => (
                        <option key={goal.id} value={goal.id}>{goal.meta.shoppingCategory === 'investment' ? '📈 ' : '🎯 '}{goal.content}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={addItemModal.label}>{isInvestmentTarget ? 'From Wallet' : 'Wallet'}</label>
                    {selectedSavingGoal?.meta.dedicatedWalletId && !isInvestmentTarget ? (
                      <div className={addItemModal.readonlyField}>
                        <Wallet className="w-4 h-4" />
                        {wallets.find((wallet) => wallet.id === selectedSavingGoal.meta.dedicatedWalletId)?.name || 'Linked to Goal'}
                      </div>
                    ) : (
                      <select value={walletId} onChange={(event) => setWalletId(event.target.value)} className={addItemModal.select}>
                        <option value="">Select Wallet</option>
                        {wallets.filter((wallet) => wallet.id !== selectedSavingGoal?.meta.dedicatedWalletId).map((wallet) => (
                          <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {isInvestmentTarget && (
                    <>
                      <div className="col-span-2">
                        <label className={addItemModal.label}>To Investment Wallet</label>
                        <div className={addItemModal.readonlyField}>
                          <Wallet className="w-4 h-4" />
                          {wallets.find((wallet) => wallet.id === toWalletId)?.name || 'No linked investment wallet'}
                        </div>
                      </div>
                      <div className={`col-span-2 ${addItemModal.accentPanel}`}>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={addItemModal.label}>Units bought</label>
                            <input type="number" step="any" value={investmentUnits} onChange={(event) => handleInvestmentUnitsChange(event.target.value)} className={addItemModal.smallInput} />
                          </div>
                          <div>
                            <label className={addItemModal.label}>Buy price / unit</label>
                            <input type="number" step="any" value={investmentUnitPrice} onChange={(event) => handleInvestmentUnitPriceChange(event.target.value)} className={addItemModal.smallInput} />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="col-span-2">
                    <label className={addItemModal.label}>Category</label>
                    <select value={category} onChange={(event) => setCategory(event.target.value)} className={addItemModal.select}>
                      <option value="">Uncategorized</option>
                      {budgetConfig.rules?.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className={addItemModal.label}>{transactionType === 'transfer' ? 'From' : 'Wallet'}</label>
                    <select value={walletId} onChange={(event) => setWalletId(event.target.value)} className={addItemModal.select}>
                      <option value="">Select Wallet</option>
                      {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
                    </select>
                  </div>
                  {transactionType === 'transfer' ? (
                    <div>
                      <label className={addItemModal.label}>To</label>
                      <select value={toWalletId} onChange={(event) => setToWalletId(event.target.value)} className={addItemModal.select}>
                        <option value="">Select Wallet</option>
                        {wallets.filter((wallet) => wallet.id !== walletId).map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className={addItemModal.label}>{transactionType === 'expense' ? 'Default category' : 'Category'}</label>
                      <select value={category} onChange={(event) => setCategory(event.target.value)} className={addItemModal.select}>
                        <option value="">Uncategorized</option>
                        {budgetConfig.rules?.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}
                      </select>
                      {transactionType === 'expense' && <p className={addItemModal.helpText}>Dipakai hanya untuk line item yang belum punya kategori sendiri.</p>}
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <label className={addItemModal.label}>Date</label>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={addItemModal.input} />
            </div>
          </div>

          <div className={addItemModal.footer}>
            <button onClick={handleSave} disabled={!canSave} className={addItemModal.primaryButton}>
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
