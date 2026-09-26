import React from 'react';
import { ArrowUpRight, ReceiptText } from 'lucide-react';
import { AppLanguage, BrainDumpItem, BudgetConfig, FinanceType, Wallet } from '../types';
import { getTransactionCategoryIds, sanitizeTransactionLineItems, sumTransactionLineItems } from '../utils/transactionLineItems';
import { normalizeAppLanguage } from '../utils/i18n';

interface Props {
  groups: { label: string; date: Date; items: BrainDumpItem[] }[];
  wallets: Wallet[];
  budgetConfig: BudgetConfig;
  typeLabels: Partial<Record<FinanceType, string>>;
  showAmounts: boolean;
  formatAmount: (amount: number) => string;
  language?: AppLanguage;
  onOpen: (item: BrainDumpItem) => void;
}

export default function TransactionLedger({ groups, wallets, budgetConfig, typeLabels, showAmounts, formatAmount, language, onOpen }: Props) {
  const en = normalizeAppLanguage(language) === 'en';
  const walletName = (value?: string) => wallets.find(wallet => wallet.id === value || wallet.name.toLowerCase() === value?.toLowerCase())?.name || value || '—';
  return <div className="overflow-hidden rounded-xl border border-border bg-surface" data-transaction-ledger="true">
    <table className="w-full table-fixed border-collapse text-left text-xs">
      <thead className="border-b border-border bg-surface-soft/60 text-[10px] text-muted">
        <tr>
          <th scope="col" className="px-4 py-3 font-medium">{en ? 'Transaction' : 'Transaksi'}</th>
          <th scope="col" className="hidden w-[17%] px-3 py-3 font-medium lg:table-cell">{en ? 'Category' : 'Kategori'}</th>
          <th scope="col" className="hidden w-[16%] px-3 py-3 font-medium md:table-cell">Wallet</th>
          <th scope="col" className="hidden w-[15%] px-3 py-3 font-medium sm:table-cell">Status</th>
          <th scope="col" className="w-32 px-4 py-3 text-right font-medium sm:w-[20%]">{en ? 'Amount' : 'Nominal'}</th>
        </tr>
      </thead>
      {groups.map(group => <tbody key={group.label}>
        <tr className="border-y border-border bg-background/70">
          <th scope="rowgroup" className="px-4 py-2 text-[10px] font-medium capitalize text-muted">{group.label}</th>
          <td className="hidden lg:table-cell" /><td className="hidden md:table-cell" /><td className="hidden sm:table-cell" />
          <td className="px-4 py-2 text-right text-[10px] text-muted">{group.items.length} {en ? 'records' : 'transaksi'}</td>
        </tr>
        {group.items.map(item => {
          const kind = item.meta.financeType || 'expense';
          const categoryIds = getTransactionCategoryIds(item);
          const category = categoryIds.length > 1 ? `${categoryIds.length} ${en ? 'categories' : 'kategori'}` : budgetConfig.rules.find(rule => rule.id === (categoryIds[0] || item.meta.budgetCategory))?.name || categoryIds[0] || item.meta.budgetCategory || '—';
          const lines = sanitizeTransactionLineItems(item.meta.transactionLineItems);
          const amount = lines.length ? sumTransactionLineItems(lines) : item.meta.amount || 0;
          const incoming = ['income', 'loan_in', 'loan_repayment_in'].includes(kind);
          const internal = ['transfer', 'saving', 'saving_withdrawal'].includes(kind);
          const needsCategory = !incoming && !internal && !kind.startsWith('loan_') && categoryIds.length === 0;
          const title = item.meta.merchant || item.content;
          return <tr key={item.id} onClick={() => onOpen(item)} className="group cursor-pointer border-b border-border/70 transition-colors last:border-b-0 hover:bg-surface-soft/60" data-transaction-row={item.id}>
            <td className="px-4 py-2.5 align-middle">
              <button type="button" onClick={event => { event.stopPropagation(); onOpen(item); }} className="block w-full min-w-0 text-left" aria-label={`${en ? 'Open transaction' : 'Buka transaksi'}: ${title}`}>
                <span className="block truncate text-[13px] font-medium text-primary">{title}</span>
                <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-muted">
                  <span className="truncate">{typeLabels[kind as FinanceType] || kind}</span>
                  {lines.length > 0 && <span className="shrink-0">· {lines.length} item</span>}
                  {item.meta.receiptCapture && <ReceiptText className="h-3 w-3 shrink-0" aria-label={en ? 'Receipt attached' : 'Ada struk'} />}
                </span>
                <span className="mt-1 block truncate text-[10px] text-muted md:hidden">{walletName(item.meta.paymentMethod)}{item.meta.toWallet ? ` → ${walletName(item.meta.toWallet)}` : ''} · {category}</span>
                <span className="mt-1 block text-[10px] text-muted sm:hidden">{item.status === 'pending' ? (en ? 'Planned' : 'Terencana') : (en ? 'Recorded' : 'Tercatat')}{needsCategory ? (en ? ' · Needs category' : ' · Perlu kategori') : ''}</span>
              </button>
            </td>
            <td className="hidden px-3 py-2.5 align-middle lg:table-cell"><span className="block truncate text-muted" title={category}>{category}</span></td>
            <td className="hidden px-3 py-2.5 align-middle md:table-cell"><span className="block truncate text-muted" title={walletName(item.meta.paymentMethod)}>{walletName(item.meta.paymentMethod)}</span>{item.meta.toWallet && <span className="mt-1 block truncate text-[10px] text-muted">→ {walletName(item.meta.toWallet)}</span>}</td>
            <td className="hidden px-3 py-2.5 align-middle sm:table-cell"><span className={`inline-flex items-center gap-1.5 text-[10px] ${item.status === 'pending' ? 'text-amber-700 dark:text-amber-300' : 'text-muted'}`}><span className={`h-1.5 w-1.5 rounded-full ${item.status === 'pending' ? 'bg-amber-500' : 'bg-brand-500'}`} />{item.status === 'pending' ? (en ? 'Planned' : 'Terencana') : (en ? 'Recorded' : 'Tercatat')}</span>{needsCategory && <span className="mt-1 block text-[10px] text-amber-700 dark:text-amber-300">{en ? 'Needs category' : 'Perlu kategori'}</span>}</td>
            <td className="px-4 py-2.5 text-right align-middle"><span data-financial-amount="true" data-finance-status={incoming ? 'positive' : internal ? 'info' : 'negative'} className="block break-words text-[13px] font-semibold tabular-nums">{showAmounts ? `${incoming ? '+' : internal ? '' : '−'}${formatAmount(amount)}` : '••••'}</span><ArrowUpRight aria-hidden="true" className="ml-auto mt-1 h-3 w-3 text-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" /></td>
          </tr>;
        })}
      </tbody>)}
    </table>
  </div>;
}
