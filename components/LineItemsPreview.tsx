import React from 'react';
import { ShoppingLineItem, TransactionLineItem } from '../types';

interface Props {
  items: (ShoppingLineItem | TransactionLineItem)[];
  currency?: string;
  budgetRules?: { id: string; name: string }[];
  defaultBudgetCategory?: string;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  maxCollapsed?: number;
  accentClassName?: string;
}

const formatMoney = (amount: number, currency = 'IDR') => {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'IDR' ? 0 : 2,
    }).format(amount || 0);
  } catch {
    return `${currency} ${(amount || 0).toLocaleString('id-ID')}`;
  }
};

const LineItemsPreview: React.FC<Props> = ({
  items,
  currency = 'IDR',
  budgetRules = [],
  defaultBudgetCategory,
  expanded = false,
  onToggleExpanded,
  maxCollapsed = 3,
  accentClassName = 'text-indigo-500',
}) => {
  const visible = expanded ? items : items.slice(0, maxCollapsed);
  return (
    <div className="mt-2 space-y-1">
      {visible.map((line) => {
        const txLine = line as TransactionLineItem;
        const categoryId = txLine.allocationMode === 'uncategorized'
          ? undefined
          : (txLine.budgetCategory || defaultBudgetCategory);
        const categoryName = budgetRules.find((rule) => rule.id === categoryId)?.name || categoryId;
        const allocationLabel = txLine.allocationMode === 'proportional' ? 'Dibagi proporsional' : categoryName;
        return (
          <div key={line.id} className="flex items-center justify-between gap-2 rounded-xl bg-background/60 px-2.5 py-1.5 text-[11px] text-muted">
            <div className="min-w-0">
              <div className="truncate">{line.name || 'Item tanpa nama'}{line.quantity ? ` · ${line.quantity}` : ''}</div>
              {allocationLabel && <div className="truncate text-[9px] opacity-75">{allocationLabel}</div>}
            </div>
            <span className="shrink-0 font-bold text-primary">{formatMoney(Number(line.amount || 0), currency)}</span>
          </div>
        );
      })}
      {items.length > maxCollapsed && onToggleExpanded && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpanded();
          }}
          className={`text-[10px] font-bold ${accentClassName} hover:underline`}
        >
          {expanded ? 'Sembunyikan rincian' : `Lihat semua ${items.length} item`}
        </button>
      )}
    </div>
  );
};

export default LineItemsPreview;
