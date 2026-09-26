import React from 'react';
import { ArrowUpRight, Check, Circle, FileText, Flag, Repeat2 } from 'lucide-react';
import { AppLanguage, BrainDumpItem } from '../../types';
import { getAppLocale, normalizeAppLanguage } from '../../utils/i18n';
import { advanceRoutineDueDateToTodayOrFuture, isSameLocalDay } from '../../utils/selectors';

export default function RecordRow({ item, onOpen, onToggle, language, childCount = 0 }: {
  item: BrainDumpItem; onOpen: () => void; onToggle?: () => void; language?: AppLanguage; childCount?: number;
}) {
  const en = normalizeAppLanguage(language) === 'en';
  const storedDate = item.meta.date ? new Date(item.meta.date) : null;
  const routineDate = item.meta.isRoutine && storedDate && !Number.isNaN(storedDate.getTime())
    ? advanceRoutineDueDateToTodayOrFuture(storedDate, item.meta.routineInterval || 'daily', item.meta.routineDaysOfWeek, item.meta.routineDaysOfMonth, item.meta.routineMonthsOfYear, new Date()) : null;
  const toggleUnavailable = Boolean(item.meta.isRoutine && (!routineDate || !isSameLocalDay(routineDate, new Date())));
  const title = item.meta.title || item.content.split('\n')[0] || (en ? 'Untitled' : 'Tanpa judul');
  const preview = item.meta.deepWorkNextAction || item.content;
  const rawDate = routineDate?.toISOString() || item.meta.date || item.meta.dateTime || item.created_at;
  const date = new Date(rawDate);
  const dateLabel = Number.isNaN(date.getTime()) ? rawDate : date.toLocaleDateString(getAppLocale(language), { day: 'numeric', month: 'short' });
  return <div data-record-row={item.id} className="record-row flex items-center gap-3 border-b border-border bg-surface px-3 py-2.5 last:border-b-0 sm:px-4">
    {onToggle ? <button type="button" onClick={onToggle} disabled={toggleUnavailable} title={toggleUnavailable ? (en ? "Open details to reset or reschedule this routine" : "Buka detail untuk mengatur ulang rutinitas") : undefined} aria-label={`${item.status === 'done' ? (en ? 'Reopen' : 'Buka kembali') : (en ? 'Complete' : 'Selesaikan')}: ${title}`} aria-pressed={item.status === 'done'} className={`flex shrink-0 items-center justify-center rounded-lg ${item.status === 'done' ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-surface-soft'}`}>{item.status === 'done' ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}</button> : <FileText className="h-4 w-4 shrink-0 text-muted" />}
    <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-4 text-left" aria-label={`${en ? 'Open' : 'Buka'}: ${title}`}>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {preview !== title && <span className="mt-1 block truncate text-xs text-muted">{preview}</span>}
        {!!item.meta.tags?.length && <span className="mt-1 block truncate text-[11px] text-muted">{item.meta.tags.map(tag => `#${tag}`).join(' · ')}</span>}
      </span>
      <span className="hidden items-center gap-2 text-xs text-muted sm:flex">
        {item.meta.isRoutine && <Repeat2 className="h-3.5 w-3.5" aria-label={en ? 'Routine' : 'Rutinitas'} />}
        {item.meta.priority === 'high' && <Flag className="h-3.5 w-3.5 text-amber-600" aria-label={en ? 'High priority' : 'Prioritas tinggi'} />}
        {childCount > 0 && <span>{childCount} {en ? 'subtasks' : 'subtugas'}</span>}
        {typeof item.meta.progress === 'number' && <span>{item.meta.progress}%</span>}
      </span>
      {onToggle && <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${item.status === 'done' ? 'bg-accent/10 text-accent' : 'bg-surface-soft text-muted'}`}>{item.status === 'done' ? (en ? 'Done' : 'Selesai') : (en ? 'Open' : 'Aktif')}</span>}
      <time className="hidden w-16 shrink-0 text-right text-xs tabular-nums text-muted md:block" dateTime={Number.isNaN(date.getTime()) ? undefined : date.toISOString()}>{dateLabel}</time>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted" />
    </button>
  </div>;
}
