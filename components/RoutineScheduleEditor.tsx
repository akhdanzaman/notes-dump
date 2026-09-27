import React from 'react';
import { Repeat } from 'lucide-react';
import type { RoutineDraft } from '../utils/routineDraft';

export type RoutineScheduleField = 'interval' | 'daysOfWeek' | 'daysOfMonth' | 'monthsOfYear';
interface RoutineScheduleEditorProps {
  value: RoutineDraft;
  onChange: (next: RoutineDraft, field: RoutineScheduleField) => void;
}

/** Shared schedule controls; date adjustment remains the responsibility of the host editor. */
export default function RoutineScheduleEditor({ value, onChange }: RoutineScheduleEditorProps) {
  const field = value.interval === 'weekly' ? 'daysOfWeek' : value.interval === 'monthly' ? 'daysOfMonth' : 'monthsOfYear';
  const labels = value.interval === 'weekly'
    ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    : value.interval === 'monthly'
      ? Array.from({ length: 31 }, (_, index) => String(index + 1))
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const title = value.interval === 'weekly' ? 'Select Days' : value.interval === 'monthly' ? 'Select Dates' : 'Select Months';
  return (
    <div className="col-span-2 bg-brand-500/5 border border-brand-500/10 rounded-xl p-4 mt-2">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center"><Repeat className="w-4 h-4 text-brand-500" /></div>
        <div>
          <h4 className="text-xs font-bold text-brand-500 uppercase tracking-wider">Routine Schedule</h4>
          <p className="text-[10px] text-muted font-medium">Configure how this task repeats</p>
        </div>
      </div>
      <div className="space-y-4">
        <div role="group" aria-label="Routine interval" className="grid grid-cols-4 gap-2 bg-background/50 p-1.5 rounded-lg border border-border/50">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(interval => (
            <button key={interval} type="button" aria-pressed={value.interval === interval}
              onClick={() => onChange({ ...value, interval }, 'interval')}
              className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${value.interval === interval ? 'bg-brand-600 text-white shadow-sm' : 'text-muted hover:text-primary hover:bg-background'}`}>
              {interval}
            </button>
          ))}
        </div>
        {value.interval !== 'daily' && (
          <div role="group" aria-label={title}>
            <div className="block text-[10px] font-bold text-muted mb-2 uppercase tracking-widest">{title}</div>
            <div className={value.interval === 'weekly' ? 'flex gap-1' : value.interval === 'monthly' ? 'grid grid-cols-7 gap-1' : 'grid grid-cols-4 gap-1.5'}>
              {labels.map((label, index) => {
                const choice = value.interval === 'monthly' ? index + 1 : index;
                const selected = value[field].includes(choice);
                return <button key={choice} type="button" aria-label={label} aria-pressed={selected}
                  onClick={() => onChange({ ...value, [field]: selected ? value[field].filter(day => day !== choice) : [...value[field], choice] }, field)}
                  className={`${value.interval === 'weekly' ? 'flex-1 h-8 rounded-lg text-[10px]' : value.interval === 'monthly' ? 'w-full aspect-square rounded-md text-[9px]' : 'py-1.5 rounded-lg text-[9px] uppercase tracking-wider'} flex items-center justify-center font-bold transition-all border ${selected ? 'bg-brand-600 border-brand-500 text-white' : 'bg-background border-border text-muted hover:border-brand-500'}`}>
                  {value.interval === 'weekly' ? label[0] : label}
                </button>;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
