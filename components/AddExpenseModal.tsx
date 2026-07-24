import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Check,
  Wallet,
  DollarSign,
  HandCoins,
  CalendarClock,
} from 'lucide-react';
import {
  BudgetConfig,
  Wallet as WalletType,
  BrainDumpItem,
  TransactionLineItem,
  ReceiptCaptureMeta,
  FinanceType,
  LoanTransactionKind,
} from '../types';
import { addItemModal, addItemModalMotion, responsiveModal } from './layout/contentSurface';
import { getDefaultInvestmentUnitPrice, resolveInvestmentFundingInput } from '../utils/investmentFunding';
import { sanitizeTransactionLineItems, sumTransactionLineItems } from '../utils/transactionLineItems';
import { getLoanAccounts } from '../utils/loanAccounts';
import LineItemsEditor from './LineItemsEditor';

export type TransactionComposerMode = 'expense' | 'income' | 'transfer' | 'saving' | 'loan';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    amount: number,
    description: string,
    category: string,
    walletId: string,
    date: string,
    type: FinanceType,
    toWalletId?: string,
    savingGoalId?: string,
    savingGoalName?: string,
    investmentUnits?: number,
    investmentUnitPrice?: number,
    transactionLineItems?: TransactionLineItem[],
    merchant?: string,
    receiptCapture?: ReceiptCaptureMeta,
    loanCounterparty?: string,
    loanAccountId?: string,
    loanDueDate?: string,
  ) => void;
  wallets: WalletType[];
  budgetConfig: BudgetConfig;
  savingGoals: BrainDumpItem[];
  items: BrainDumpItem[];
  initialMode?: TransactionComposerMode;
  initialLoanAccountId?: string;
}

const todayInputValue = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const dateInputValue = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const loanActionLabels: Record<LoanTransactionKind, { title: string; description: string }> = {
  loan_out: { title: 'Saya meminjamkan', description: 'Uang keluar dan menjadi piutang.' },
  loan_in: { title: 'Saya meminjam', description: 'Uang masuk dan menjadi utang.' },
  loan_repayment_in: { title: 'Pengembalian diterima', description: 'Piutang berkurang.' },
  loan_repayment_out: { title: 'Saya membayar kembali', description: 'Utang berkurang.' },
};

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  wallets,
  budgetConfig,
  savingGoals,
  items,
  initialMode = 'expense',
  initialLoanAccountId,
}) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('');
  const [walletId, setWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [savingGoalId, setSavingGoalId] = useState('');
  const [date, setDate] = useState(todayInputValue());
  const [transactionType, setTransactionType] = useState<TransactionComposerMode>(initialMode);
  const [investmentUnits, setInvestmentUnits] = useState('');
  const [investmentUnitPrice, setInvestmentUnitPrice] = useState('');
  const [transactionLineItems, setTransactionLineItems] = useState<TransactionLineItem[]>([]);
  const [loanKind, setLoanKind] = useState<LoanTransactionKind>('loan_out');
  const [loanCounterparty, setLoanCounterparty] = useState('');
  const [loanAccountId, setLoanAccountId] = useState('');
  const [loanDueDate, setLoanDueDate] = useState('');

  const loanAccounts = useMemo(() => getLoanAccounts(items), [items]);
  const selectedLoanAccount = loanAccounts.find((account) => account.id === loanAccountId);
  const repaymentDirection = loanKind === 'loan_repayment_in' ? 'receivable' : 'payable';
  const repaymentAccounts = loanAccounts.filter((account) =>
    account.remainingAmount > 0 && account.direction === repaymentDirection
  );
  const isLoanMode = transactionType === 'loan';
  const isLoanRepayment = loanKind === 'loan_repayment_in' || loanKind === 'loan_repayment_out';

  useEffect(() => {
    if (!isOpen) return;
    setTransactionType(initialMode);
    if (initialMode !== 'loan' || !initialLoanAccountId) return;
    const account = loanAccounts.find((candidate) => candidate.id === initialLoanAccountId);
    if (!account || account.remainingAmount <= 0) return;
    setLoanKind(account.direction === 'receivable' ? 'loan_repayment_in' : 'loan_repayment_out');
    setLoanAccountId(account.id);
    setLoanCounterparty(account.counterparty);
    setWalletId(account.preferredWalletId || '');
    setLoanDueDate(dateInputValue(account.dueDate));
  }, [isOpen, initialMode, initialLoanAccountId, loanAccounts]);

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
  const needsDefaultCategory = transactionType !== 'expense' || transactionLineItems.length === 0 || transactionLineItems.some((line) =>
    line.allocationMode !== 'proportional'
    && line.allocationMode !== 'uncategorized'
    && !line.budgetCategory
  );

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
    setLoanKind('loan_out');
    setLoanCounterparty('');
    setLoanAccountId('');
    setLoanDueDate('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const chooseLoanKind = (kind: LoanTransactionKind) => {
    setLoanKind(kind);
    setLoanAccountId('');
    setLoanDueDate('');
    if (kind === 'loan_out' || kind === 'loan_in') setLoanCounterparty('');
  };

  const chooseLoanAccount = (accountId: string) => {
    setLoanAccountId(accountId);
    const account = loanAccounts.find((candidate) => candidate.id === accountId);
    if (!account) return;
    setLoanCounterparty(account.counterparty);
    setWalletId(account.preferredWalletId || walletId);
  };

  const generatedLoanDescription = () => {
    const counterparty = loanCounterparty.trim();
    switch (loanKind) {
      case 'loan_out': return `Pinjaman kepada ${counterparty}`;
      case 'loan_in': return `Pinjaman dari ${counterparty}`;
      case 'loan_repayment_in': return `Pengembalian pinjaman dari ${counterparty}`;
      case 'loan_repayment_out': return `Pembayaran pinjaman kepada ${counterparty}`;
    }
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
      : isLoanMode
        ? (description.trim() || generatedLoanDescription())
        : description.trim();
    const finalAmount = transactionType === 'expense' && sanitizedLineItems.length
      ? lineItemsTotal
      : isInvestmentTarget
        ? resolvedInvestmentFunding.investedCapital
        : Number(amount);
    const finalFinanceType: FinanceType = isLoanMode ? loanKind : transactionType;

    if (!finalAmount || finalAmount <= 0) return;
    if (transactionType !== 'saving' && !finalDescription) return;
    if (transactionType === 'transfer' && (!walletId || !toWalletId)) return;
    if (transactionType === 'saving' && !savingGoalId) return;
    if (transactionType !== 'saving' && transactionType !== 'transfer' && !walletId) return;
    if (transactionType === 'saving' && isInvestmentTarget && (!walletId || !toWalletId)) return;
    if (isLoanMode && !loanCounterparty.trim()) return;
    if (isLoanMode && isLoanRepayment && !loanAccountId) return;
    if (isLoanMode && isLoanRepayment && selectedLoanAccount && finalAmount > selectedLoanAccount.remainingAmount) return;

    onSave(
      finalAmount,
      finalDescription,
      category,
      finalWalletId,
      date,
      finalFinanceType,
      finalToWalletId,
      savingGoalId,
      goalName,
      isInvestmentTarget ? resolvedInvestmentFunding.units : undefined,
      isInvestmentTarget ? resolvedInvestmentFunding.unitPrice : undefined,
      transactionType === 'expense' && sanitizedLineItems.length ? sanitizedLineItems : undefined,
      merchant.trim() || undefined,
      undefined,
      isLoanMode ? loanCounterparty.trim() : undefined,
      isLoanMode ? (loanAccountId || undefined) : undefined,
      isLoanMode && !isLoanRepayment && loanDueDate ? new Date(`${loanDueDate}T12:00:00`).toISOString() : undefined,
    );
    resetForm();
    onClose();
  };

  const effectiveAmount = transactionType === 'expense' && sanitizedLineItems.length
    ? lineItemsTotal
    : isInvestmentTarget
      ? resolvedInvestmentFunding.investedCapital || 0
      : Number(amount) || 0;
  const exceedsLoanBalance = isLoanMode && isLoanRepayment && !!selectedLoanAccount && effectiveAmount > selectedLoanAccount.remainingAmount;
  const canSave = effectiveAmount > 0
    && (transactionType === 'saving' || isLoanMode || !!description.trim())
    && (transactionType === 'saving' || transactionType === 'transfer' || !!walletId)
    && (transactionType !== 'transfer' || (!!walletId && !!toWalletId))
    && (transactionType !== 'saving' || !!savingGoalId)
    && !(transactionType === 'saving' && isInvestmentTarget && (!walletId || !toWalletId))
    && (!isLoanMode || !!loanCounterparty.trim())
    && (!isLoanMode || !isLoanRepayment || !!loanAccountId)
    && !exceedsLoanBalance;

  const modeLabel = transactionType === 'expense'
    ? 'Pengeluaran'
    : transactionType === 'income'
      ? 'Pemasukan'
      : transactionType === 'transfer'
        ? 'Transfer'
        : transactionType === 'saving'
          ? 'Tabungan'
          : 'Utang & Piutang';

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
              {isLoanMode
                ? <HandCoins className="w-5 h-5 text-amber-500" />
                : <DollarSign className={`w-5 h-5 ${transactionType === 'expense' ? 'text-red-500' : transactionType === 'income' ? 'text-green-500' : 'text-indigo-500'}`} />}
              {modeLabel}
            </h3>
            <button onClick={handleClose} className={addItemModal.closeButton}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className={addItemModal.body}>
            <div className={`${addItemModal.tabGroup} overflow-x-auto no-scrollbar`}>
              {(['expense', 'income', 'transfer', 'saving', 'loan'] as TransactionComposerMode[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTransactionType(type)}
                  className={`${addItemModal.tabButton(transactionType === type)} whitespace-nowrap`}
                >
                  {type === 'loan' ? 'pinjaman' : type}
                </button>
              ))}
            </div>

            {isLoanMode && (
              <div>
                <label className={addItemModal.label}>Arah transaksi</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(loanActionLabels) as LoanTransactionKind[]).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => chooseLoanKind(kind)}
                      className={`rounded-2xl border p-3 text-left transition-colors ${loanKind === kind ? 'border-amber-500 bg-amber-500/10' : 'border-border bg-background hover:border-amber-500/40'}`}
                    >
                      <div className="text-xs font-bold text-primary">{loanActionLabels[kind].title}</div>
                      <div className="mt-1 text-[10px] leading-relaxed text-muted">{loanActionLabels[kind].description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLoanMode && isLoanRepayment && (
              <div>
                <label className={addItemModal.label}>Pinjaman yang dibayar</label>
                <select value={loanAccountId} onChange={(event) => chooseLoanAccount(event.target.value)} className={addItemModal.select}>
                  <option value="">Pilih tanggungan aktif</option>
                  {repaymentAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.counterparty} · sisa Rp {account.remainingAmount.toLocaleString('id-ID')}
                    </option>
                  ))}
                </select>
                {repaymentAccounts.length === 0 && (
                  <p className={addItemModal.helpText}>Belum ada tanggungan aktif yang sesuai dengan arah pengembalian ini.</p>
                )}
              </div>
            )}

            <div>
              <label className={addItemModal.label}>{isInvestmentTarget ? 'Modal investasi' : isLoanRepayment ? 'Jumlah pembayaran' : 'Jumlah'}</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold">Rp</span>
                <input
                  type="number"
                  value={hasLineItems ? String(lineItemsTotal) : amount}
                  onChange={(event) => handleAmountChange(event.target.value)}
                  readOnly={hasLineItems}
                  max={selectedLoanAccount?.remainingAmount}
                  placeholder="0"
                  className={`${addItemModal.titleInput} pl-12 ${hasLineItems ? 'opacity-70' : ''}`}
                />
              </div>
              {hasLineItems && <p className={addItemModal.helpText}>Total dihitung otomatis dari seluruh rincian item.</p>}
              {isLoanRepayment && selectedLoanAccount && (
                <p className={`${addItemModal.helpText} ${exceedsLoanBalance ? 'text-red-500' : ''}`}>
                  Sisa tanggungan: Rp {selectedLoanAccount.remainingAmount.toLocaleString('id-ID')}. Pembayaran boleh parsial, tetapi tidak melebihi sisa.
                </p>
              )}
            </div>

            {isLoanMode ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={addItemModal.label}>Pihak terkait</label>
                  <input
                    type="text"
                    value={loanCounterparty}
                    onChange={(event) => setLoanCounterparty(event.target.value)}
                    readOnly={isLoanRepayment && !!selectedLoanAccount}
                    placeholder={loanKind === 'loan_out' || loanKind === 'loan_repayment_in' ? 'Nama peminjam' : 'Nama pemberi pinjaman'}
                    className={`${addItemModal.input} ${isLoanRepayment && selectedLoanAccount ? 'opacity-70' : ''}`}
                  />
                </div>
                <div>
                  <label className={addItemModal.label}>Catatan</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Opsional; dibuat otomatis bila kosong"
                    className={addItemModal.input}
                  />
                </div>
              </div>
            ) : transactionType !== 'saving' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={transactionType === 'transfer' ? 'sm:col-span-2' : ''}>
                  <label className={addItemModal.label}>Deskripsi</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder={transactionType === 'expense' ? 'Nama transaksi' : transactionType === 'income' ? 'Sumber pemasukan' : 'Deskripsi'}
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
                      placeholder="Opsional"
                      className={addItemModal.input}
                    />
                  </div>
                )}
              </div>
            )}

            {transactionType === 'expense' && (
              <LineItemsEditor
                variant="transaction"
                value={transactionLineItems}
                onChange={setTransactionLineItems}
                budgetRules={budgetConfig.rules || []}
                defaultBudgetCategory={category || undefined}
                title="Rincian transaksi"
                helpText="Satu transaksi dapat memakai beberapa kategori budget. Total dihitung otomatis."
              />
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
                        <option value="">Pilih wallet</option>
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
                  <div className={isLoanMode ? 'col-span-2' : ''}>
                    <label className={addItemModal.label}>
                      {transactionType === 'transfer'
                        ? 'From'
                        : isLoanMode && (loanKind === 'loan_in' || loanKind === 'loan_repayment_in')
                          ? 'Wallet penerima'
                          : isLoanMode
                            ? 'Wallet pembayaran'
                            : 'Wallet'}
                    </label>
                    <select value={walletId} onChange={(event) => setWalletId(event.target.value)} className={addItemModal.select}>
                      <option value="">Pilih wallet</option>
                      {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
                    </select>
                  </div>
                  {transactionType === 'transfer' ? (
                    <div>
                      <label className={addItemModal.label}>To</label>
                      <select value={toWalletId} onChange={(event) => setToWalletId(event.target.value)} className={addItemModal.select}>
                        <option value="">Pilih wallet</option>
                        {wallets.filter((wallet) => wallet.id !== walletId).map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}
                      </select>
                    </div>
                  ) : !isLoanMode && needsDefaultCategory ? (
                    <div>
                      <label className={addItemModal.label}>{transactionType === 'expense' ? 'Kategori default' : 'Kategori'}</label>
                      <select value={category} onChange={(event) => setCategory(event.target.value)} className={addItemModal.select}>
                        <option value="">Tanpa kategori</option>
                        {budgetConfig.rules?.map((rule) => <option key={rule.id} value={rule.id}>{rule.name}</option>)}
                      </select>
                      {transactionType === 'expense' && <p className={addItemModal.helpText}>Dipakai hanya untuk item yang memilih kategori default.</p>}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {isLoanMode && !isLoanRepayment && (
              <div>
                <label className={addItemModal.label}>Jatuh tempo</label>
                <div className="relative">
                  <CalendarClock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input type="date" value={loanDueDate} onChange={(event) => setLoanDueDate(event.target.value)} className={`${addItemModal.input} pl-10`} />
                </div>
                <p className={addItemModal.helpText}>Opsional, tetapi disarankan agar pengingat tanggungan lebih berguna.</p>
              </div>
            )}

            <div>
              <label className={addItemModal.label}>Tanggal transaksi</label>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={addItemModal.input} />
            </div>
          </div>

          <div className={addItemModal.footer}>
            <button onClick={handleSave} disabled={!canSave} className={addItemModal.primaryButton}>
              <Check className="w-5 h-5" />
              Simpan {modeLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AddExpenseModal;
