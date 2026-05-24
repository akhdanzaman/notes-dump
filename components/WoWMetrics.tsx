import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import type { WeeklyComparison, CategoryBreakdown } from '../utils/biEngine';

const fmt = (n: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
}).format(n);

const fmtCompact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

const deltaBadge = (pct: number) => {
  if (Math.abs(pct) < 0.03) return null;
  const up = pct > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${up ? 'text-red-500' : 'text-emerald-500'}`}>
      {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {up ? '+' : ''}{(pct * 100).toFixed(0)}%
    </span>
  );
};

// ── WoW Cards ─────────────────────────────────────────────

type WoWProps = { data: WeeklyComparison };

export const WoWComparisonCards: React.FC<WoWProps> = ({ data }) => {
  const cards = [
    {
      label: 'Spending',
      current: fmtCompact(data.spending.current),
      sub: deltaBadge(data.spending.deltaPercent),
      detail: data.spending.previous > 0
        ? `vs ${fmtCompact(data.spending.previous)} last week`
        : '',
    },
    {
      label: 'Tasks Done',
      current: String(data.tasksDone.current),
      sub: deltaBadge(data.tasksDone.deltaPercent),
      detail: data.tasksDone.previous > 0
        ? `vs ${data.tasksDone.previous} last week`
        : '',
    },
    {
      label: 'Top Category',
      current: data.topCategory.name,
      sub: data.topCategory.amount > 0 ? (
        <span className="text-[10px] font-bold text-muted">{fmtCompact(data.topCategory.amount)}</span>
      ) : null,
      detail: data.topCategory.previousAmount > 0
        ? `was ${fmtCompact(data.topCategory.previousAmount)}`
        : '',
    },
    {
      label: 'Avg / Day',
      current: fmtCompact(data.avgDailySpend.current),
      sub: deltaBadge(data.avgDailySpend.deltaPercent),
      detail: '',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">This Week vs Last</span>
        <ArrowRight className="w-3 h-3 text-muted opacity-30" />
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {cards.map((card, i) => (
          <div
            key={i}
            className="rounded-xl bg-surface border border-border/50 p-2.5 flex flex-col gap-0.5"
          >
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
              {card.label}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-[15px] font-bold text-primary leading-tight truncate">
                {card.current}
              </span>
              {card.sub}
            </div>
            {card.detail && (
              <span className="text-[10px] text-muted opacity-50 leading-tight">{card.detail}</span>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// ── Category Breakdown ────────────────────────────────────

type CatProps = { data: CategoryBreakdown[]; onClick?: () => void };

export const CategoryBreakdownBars: React.FC<CatProps> = ({ data, onClick }) => {
  if (data.length === 0) return null;

  return (
    <div className="mt-3 pt-2.5 border-t border-border/40">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted">Top Categories</span>
        {onClick && (
          <button onClick={onClick} className="text-[10px] font-bold opacity-40 hover:opacity-100 uppercase tracking-wider">
            Details
          </button>
        )}
      </div>
      <div className="space-y-2">
        {data.map((cat, i) => (
          <div key={i}>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="font-medium text-primary">{cat.name}</span>
              <span className="font-bold tabular-nums text-muted">{fmtCompact(cat.amount)}</span>
            </div>
            <div className="h-1.5 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  cat.limitPercent > 100 ? 'bg-red-500' :
                  cat.limitPercent > 75 ? 'bg-amber-500' :
                  'bg-indigo-400'
                }`}
                style={{ width: `${Math.min(100, cat.limitPercent || cat.percent)}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] mt-0.5 opacity-40">
              <span>{cat.percent.toFixed(0)}% of week spend</span>
              {cat.limit > 0 && (
                <span>{cat.limitPercent.toFixed(0)}% of weekly limit</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
