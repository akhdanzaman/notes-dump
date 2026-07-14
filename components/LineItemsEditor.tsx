import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  ShoppingLineItem,
  TransactionLineItem,
} from '../types';
import { createShoppingLineItemId, sumShoppingLineItems } from '../utils/shoppingLineItems';
import {
  createTransactionLineItemId,
  sumTransactionLineItems,
} from '../utils/transactionLineItems';

interface BaseProps {
  budgetRules?: { id: string; name: string }[];
  currency?: string;
  compact?: boolean;
  className?: string;
  title?: string;
  helpText?: string;
}

interface ShoppingProps extends BaseProps {
  variant: 'shopping';
  value: ShoppingLineItem[];
  onChange: (items: ShoppingLineItem[]) => void;
  defaultBudgetCategory?: never;
}

interface TransactionProps extends BaseProps {
  variant: 'transaction';
  value: TransactionLineItem[];
  onChange: (items: TransactionLineItem[]) => void;
  defaultBudgetCategory?: string;
}

type LineItemsEditorProps = ShoppingProps | TransactionProps;

const parseNumericQuantity = (value?: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value.replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

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

const LineItemsEditor: React.FC<LineItemsEditorProps> = (props) => {
  const currency = props.currency || 'IDR';
  const total = useMemo(
    () => props.variant === 'shopping'
      ? sumShoppingLineItems(props.value)
      : sumTransactionLineItems(props.value),
    [props.variant, props.value],
  );

  const addItem = () => {
    if (props.variant === 'shopping') {
      props.onChange([
        ...props.value,
        { id: createShoppingLineItemId(), name: '', quantity: '', amount: undefined },
      ]);
      return;
    }
    props.onChange([
      ...props.value,
      {
        id: createTransactionLineItemId(),
        name: '',
        quantity: '',
        amount: 0,
        kind: 'item',
        allocationMode: 'category',
      },
    ]);
  };

  const removeItem = (id: string) => {
    props.onChange(props.value.filter((line) => line.id !== id) as never);
  };

  const updateShopping = (id: string, patch: Partial<ShoppingLineItem>) => {
    if (props.variant !== 'shopping') return;
    props.onChange(props.value.map((line) => line.id === id ? { ...line, ...patch } : line));
  };

  const updateTransaction = (id: string, patch: Partial<TransactionLineItem>) => {
    if (props.variant !== 'transaction') return;
    props.onChange(props.value.map((line) => {
      if (line.id !== id) return line;
      const next = { ...line, ...patch };
      const quantity = parseNumericQuantity(next.quantity);
      if (quantity && patch.amount !== undefined) next.unitPrice = Number(next.amount) / quantity;
      if (quantity && patch.quantity !== undefined && Number.isFinite(next.amount)) next.unitPrice = Number(next.amount) / quantity;
      if (patch.quantity !== undefined && !quantity) next.unitPrice = undefined;
      return next;
    }));
  };

  return (
    <section className={`rounded-2xl border border-border bg-background/50 p-3 space-y-3 ${props.className || ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase text-muted font-bold tracking-wider">
            {props.title || 'Rincian item'}
          </div>
          <div className="text-[10px] text-muted">
            {props.helpText || 'Total transaksi dihitung otomatis dari seluruh item.'}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs font-bold text-primary">{formatMoney(total, currency)}</div>
          <button
            type="button"
            onClick={addItem}
            className="mt-1 inline-flex items-center gap-1 rounded-xl bg-indigo-500/10 px-2.5 py-1.5 text-[10px] font-bold text-indigo-500 hover:bg-indigo-500/20"
          >
            <Plus className="h-3 w-3" /> Tambah item
          </button>
        </div>
      </div>

      {props.value.length === 0 ? (
        <button
          type="button"
          onClick={addItem}
          className="w-full rounded-xl border border-dashed border-border py-4 text-xs font-medium text-muted hover:border-indigo-500/40 hover:text-indigo-500"
        >
          Tambahkan rincian item
        </button>
      ) : (
        <div className="space-y-2">
          {props.value.map((line, index) => {
            const numericQuantity = parseNumericQuantity(line.quantity);
            const derivedUnitPrice = props.variant === 'transaction' && numericQuantity && Number.isFinite(line.amount)
              ? Number(line.amount) / numericQuantity
              : undefined;
            const isAdjustment = props.variant === 'transaction' && line.kind && line.kind !== 'item';
            return (
              <div key={line.id} className="rounded-2xl border border-border bg-surface/70 p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-[10px] font-bold text-muted">{index + 1}.</span>
                  <input
                    className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-primary focus:border-indigo-500 focus:outline-none"
                    value={line.name}
                    onChange={(event) => props.variant === 'shopping'
                      ? updateShopping(line.id, { name: event.target.value })
                      : updateTransaction(line.id, { name: event.target.value })}
                    placeholder={`Nama item ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(line.id)}
                    className="rounded-full p-2 text-muted hover:bg-red-500/10 hover:text-red-500"
                    aria-label="Hapus item"
                    title="Hapus item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className={`grid gap-2 ${props.variant === 'transaction' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'}`}>
                  <div>
                    <label className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-muted">Jumlah</label>
                    <input
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-primary focus:border-indigo-500 focus:outline-none"
                      value={line.quantity || ''}
                      onChange={(event) => props.variant === 'shopping'
                        ? updateShopping(line.id, { quantity: event.target.value })
                        : updateTransaction(line.id, { quantity: event.target.value })}
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-muted">Total item</label>
                    <input
                      type="number"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-primary focus:border-indigo-500 focus:outline-none"
                      value={line.amount ?? ''}
                      onChange={(event) => {
                        const amount = event.target.value === '' ? undefined : Number(event.target.value);
                        if (props.variant === 'shopping') updateShopping(line.id, { amount });
                        else updateTransaction(line.id, { amount: amount || 0 });
                      }}
                      placeholder="0"
                    />
                    {derivedUnitPrice !== undefined && (
                      <div className="mt-1 truncate text-[9px] text-muted">
                        ≈ {formatMoney(derivedUnitPrice, currency)} / unit
                      </div>
                    )}
                  </div>

                  {props.variant === 'transaction' && (
                    <>
                      <div>
                        <label className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-muted">Jenis</label>
                        <select
                          className="w-full rounded-xl border border-border bg-background px-2 py-2 text-xs text-primary focus:border-indigo-500 focus:outline-none"
                          value={line.kind || 'item'}
                          onChange={(event) => {
                            const kind = event.target.value as TransactionLineItem['kind'];
                            updateTransaction(line.id, {
                              kind,
                              allocationMode: kind && kind !== 'item' && !line.budgetCategory ? 'proportional' : line.allocationMode,
                            });
                          }}
                        >
                          <option value="item">Item</option>
                          <option value="tax">Pajak</option>
                          <option value="fee">Biaya</option>
                          <option value="discount">Diskon</option>
                          <option value="adjustment">Penyesuaian</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[9px] font-bold uppercase tracking-wide text-muted">
                          {isAdjustment ? 'Alokasi budget' : 'Kategori budget'}
                        </label>
                        <select
                          className="w-full rounded-xl border border-border bg-background px-2 py-2 text-xs text-primary focus:border-indigo-500 focus:outline-none"
                          value={line.allocationMode === 'proportional'
                            ? '__proportional__'
                            : line.allocationMode === 'uncategorized'
                              ? '__uncategorized__'
                              : (line.budgetCategory || '')}
                          onChange={(event) => {
                            const value = event.target.value;
                            if (value === '__proportional__') {
                              updateTransaction(line.id, { allocationMode: 'proportional', budgetCategory: undefined });
                            } else if (value === '__uncategorized__') {
                              updateTransaction(line.id, { allocationMode: 'uncategorized', budgetCategory: undefined });
                            } else {
                              updateTransaction(line.id, { allocationMode: 'category', budgetCategory: value || undefined });
                            }
                          }}
                        >
                          {isAdjustment && <option value="__proportional__">Bagikan proporsional</option>}
                          <option value="">Gunakan kategori default</option>
                          <option value="__uncategorized__">Tanpa kategori</option>
                          {(props.budgetRules || []).map((rule) => (
                            <option key={rule.id} value={rule.id}>{rule.name}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default LineItemsEditor;
