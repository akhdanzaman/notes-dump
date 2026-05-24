import React from 'react';
import { motion } from 'framer-motion';
import { Target, Sprout, PiggyBank, TrendingUp, ArrowRight } from 'lucide-react';
import type { ActiveGoal, SkillProgress } from '../utils/biEngine';

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

// ── Goals Progress ────────────────────────────────────────

type GoalsProps = {
  goals: ActiveGoal[];
  onClick?: () => void;
};

export const GoalsProgressWidget: React.FC<GoalsProps> = ({ goals, onClick }) => {
  if (goals.length === 0) return null;

  return (
    <section className="lg:order-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-amber-500" />
          Goals
        </h2>
        {onClick && (
          <button
            onClick={onClick}
            className="text-xs font-bold opacity-50 hover:opacity-100 uppercase tracking-wider flex items-center gap-1"
          >
            All <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {goals.map(goal => (
          <div
            key={goal.id}
            className="rounded-2xl bg-surface border border-border/60 p-3"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-primary truncate max-w-[70%]">
                {goal.name}
              </span>
              <span className="text-xs font-bold tabular-nums text-muted">
                {fmtCompact(goal.saved)} / {fmtCompact(goal.target)}
              </span>
            </div>
            <div className="h-2 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  goal.percent >= 80 ? 'bg-emerald-500' :
                  goal.percent >= 40 ? 'bg-amber-500' :
                  'bg-indigo-400'
                }`}
                style={{ width: `${Math.max(2, goal.percent)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] mt-1 opacity-40">
              <span>{goal.percent.toFixed(0)}% funded</span>
              <span>{fmtCompact(goal.target - goal.saved)} remaining</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

// ── Skill Progress ─────────────────────────────────────────

type SkillsProps = {
  skills: SkillProgress[];
};

export const SkillProgressWidget: React.FC<SkillsProps> = ({ skills }) => {
  if (skills.length === 0) return null;

  return (
    <section className="lg:order-6">
      <h2 className="text-base font-bold flex items-center gap-2 mb-3">
        <Sprout className="w-4 h-4 text-emerald-500" />
        Practice
      </h2>

      <div className="space-y-3">
        {skills.map(skill => (
          <div
            key={skill.id}
            className="rounded-2xl bg-surface border border-border/60 p-3"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-semibold text-primary">
                {skill.name}
              </span>
              <span className="text-xs font-bold tabular-nums text-muted">
                {skill.weeklyMinutes}m / {skill.weeklyTarget}m
              </span>
            </div>
            <div className="h-2 bg-black/5 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  skill.percent >= 80 ? 'bg-emerald-500' :
                  skill.percent >= 30 ? 'bg-amber-500' :
                  'bg-red-400'
                }`}
                style={{ width: `${Math.max(3, skill.percent)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] mt-1 opacity-40">
              <span>{skill.percent.toFixed(0)}% of target</span>
              <span>{skill.sessionsThisWeek} session{skill.sessionsThisWeek !== 1 ? 's' : ''} this week</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
