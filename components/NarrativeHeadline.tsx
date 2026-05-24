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
      className={`relative overflow-hidden rounded-[20px] border ${style.border} ${style.bg} p-3`}
    >
      {/* accent bar */}
      <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${style.accent}`} />

      <div className="pl-2.5">
        {/* headline row */}
        <div className="flex items-start gap-2 mb-1.5">
          <Sparkles className={`w-4 h-4 mt-0.5 shrink-0 ${style.icon}`} />
          <div>
            <h3 className="text-[13px] font-bold leading-snug text-primary">
              {data.headline}
            </h3>
            {data.detail && (
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                {data.detail}
              </p>
            )}
          </div>
        </div>

        {/* metric chips */}
        <div className="flex gap-1.5 mt-2.5 overflow-x-auto scrollbar-hide -mx-0.5 px-0.5">
          {data.metrics.map((metric, i) => (
            <div
              key={i}
              className="flex-shrink-0 flex items-center gap-1.5 rounded-xl bg-white/60 dark:bg-white/5 border border-border/50 px-2.5 py-1.5 min-w-0"
            >
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted leading-none">
                  {metric.label}
                </span>
                <span className="text-[13px] font-bold text-primary leading-tight truncate mt-0.5">
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
