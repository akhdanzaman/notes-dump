import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import type { NarrativeHeadline as HeadlineData, DeltaMetric } from '../utils/biEngine';

type Props = {
  data: HeadlineData;
};

const trendIcon = (metric: DeltaMetric) => {
  if (metric.trend === 'up') return <TrendingUp className="w-3 h-3" />;
  if (metric.trend === 'down') return <TrendingDown className="w-3 h-3" />;
  return <Minus className="w-3 h-3" />;
};

const trendTextColor = (color: DeltaMetric['trendColor']) => {
  if (color === 'red') return 'text-red-500';
  if (color === 'green') return 'text-emerald-500';
  return 'text-muted';
};

const toneStyles: Record<HeadlineData['tone'], { bg: string; border: string; icon: string; accent: string }> = {
  good: {
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/20',
    icon: 'text-emerald-500',
    accent: 'bg-emerald-500',
  },
  warning: {
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20',
    icon: 'text-amber-500',
    accent: 'bg-amber-500',
  },
  neutral: {
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    icon: 'text-blue-500',
    accent: 'bg-blue-500',
  },
};

export const NarrativeHeadlineCard: React.FC<Props> = ({ data }) => {
  const style = toneStyles[data.tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className={`relative overflow-hidden rounded-[24px] border ${style.border} ${style.bg} p-4 lg:p-5`}
    >
      {/* accent bar */}
      <div className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-full ${style.accent}`} />

      <div className="pl-3">
        {/* headline row */}
        <div className="flex items-start gap-2 mb-2">
          <Sparkles className={`w-4 h-4 mt-0.5 shrink-0 ${style.icon}`} />
          <div>
            <h3 className="text-sm font-bold leading-snug text-primary">
              {data.headline}
            </h3>
            {data.detail && (
              <p className="text-xs text-muted mt-1 leading-relaxed max-w-prose">
                {data.detail}
              </p>
            )}
          </div>
        </div>

        {/* metric chips */}
        <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {data.metrics.map((metric, i) => (
            <div
              key={i}
              className="flex-shrink-0 flex items-center gap-2 rounded-2xl bg-white/60 dark:bg-white/5 border border-border/60 px-3 py-2 min-w-0"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted leading-none mb-0.5">
                  {metric.label}
                </span>
                <span className="text-sm font-bold text-primary leading-tight truncate">
                  {metric.current}
                </span>
                {metric.subtext && (
                  <span className={`text-[10px] font-medium mt-0.5 flex items-center gap-0.5 ${trendTextColor(metric.trendColor)}`}>
                    {trendIcon(metric)}
                    {metric.subtext}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
