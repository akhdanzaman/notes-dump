import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Target, Image as ImageIcon, CalendarClock, Clock } from 'lucide-react';
import { Skill, SkillSchedule } from '../types';
import { addItemModal, addItemModalMotion, responsiveModal } from './layout/contentSurface';

export type SkillModalPayload = {
  name: string;
  description?: string;
  imageUrl?: string;
  weeklyTargetMinutes?: number;
  schedule?: SkillSchedule;
};

interface SkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: SkillModalPayload) => void;
  initialSkill?: Skill;
  mode: 'add' | 'edit';
}

const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const intervals: SkillSchedule['interval'][] = ['daily', 'weekly', 'monthly', 'yearly'];

const today = new Date();

const defaultSchedule = (): SkillSchedule => ({
  enabled: false,
  interval: 'weekly',
  daysOfWeek: [today.getDay()],
  daysOfMonth: [today.getDate()],
  monthsOfYear: [today.getMonth()],
  startTime: '09:00',
  endTime: '10:00',
});

const toggleNumber = (list: number[] = [], value: number) =>
  list.includes(value) ? list.filter(item => item !== value) : [...list, value].sort((a, b) => a - b);

const parseTimeToMinutes = (time: string) => {
  const [hourRaw, minuteRaw] = time.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
};

const getDurationMinutes = (schedule: SkillSchedule) => {
  let start = parseTimeToMinutes(schedule.startTime);
  let end = parseTimeToMinutes(schedule.endTime);
  if (end <= start) end += 24 * 60;
  return Math.max(end - start, 1);
};

const getWeeklySessionCount = (schedule: SkillSchedule) => {
  if (!schedule.enabled) return 0;
  if (schedule.interval === 'daily') return 7;
  if (schedule.interval === 'weekly') return schedule.daysOfWeek?.length || 1;
  if (schedule.interval === 'monthly') return 1;
  if (schedule.interval === 'yearly') return 0;
  return 0;
};

const SkillModal: React.FC<SkillModalProps> = ({ isOpen, onClose, onSave, initialSkill, mode }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [weeklyTargetMinutes, setWeeklyTargetMinutes] = useState('');
  const [schedule, setSchedule] = useState<SkillSchedule>(defaultSchedule);

  useEffect(() => {
    if (!isOpen) return;

    setName(initialSkill?.name || '');
    setDescription(initialSkill?.description || '');
    setImageUrl(initialSkill?.imageUrl || '');
    setWeeklyTargetMinutes(initialSkill?.weeklyTargetMinutes ? String(initialSkill.weeklyTargetMinutes) : '');
    setSchedule(initialSkill?.schedule ? { ...defaultSchedule(), ...initialSkill.schedule } : defaultSchedule());
  }, [isOpen, initialSkill]);

  const derivedWeeklyTarget = useMemo(() => {
    if (!schedule.enabled) return 0;
    return getDurationMinutes(schedule) * getWeeklySessionCount(schedule);
  }, [schedule]);

  const handleSave = () => {
    if (!name.trim()) return;

    const parsedWeeklyTarget = Number(weeklyTargetMinutes);
    const nextSchedule = schedule.enabled ? {
      ...schedule,
      daysOfWeek: schedule.interval === 'weekly' ? (schedule.daysOfWeek?.length ? schedule.daysOfWeek : [new Date().getDay()]) : undefined,
      daysOfMonth: schedule.interval === 'monthly' ? (schedule.daysOfMonth?.length ? schedule.daysOfMonth : [new Date().getDate()]) : undefined,
      monthsOfYear: schedule.interval === 'yearly' ? (schedule.monthsOfYear?.length ? schedule.monthsOfYear : [new Date().getMonth()]) : undefined,
    } : undefined;

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      imageUrl: imageUrl.trim() || undefined,
      weeklyTargetMinutes: Number.isFinite(parsedWeeklyTarget) && parsedWeeklyTarget > 0 ? parsedWeeklyTarget : undefined,
      schedule: nextSchedule,
    });

    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className={responsiveModal.sheetOverlay} data-tablet-modal-overlay="skill">
        <motion.div
          initial={addItemModalMotion.initial}
          animate={addItemModalMotion.animate}
          exit={addItemModalMotion.exit}
          transition={addItemModalMotion.transition}
          className={`${addItemModal.panel} max-w-3xl`}
          data-tablet-modal-panel="skill"
          data-ndz-tablet-baseline="modal"
        >
          <div className={addItemModal.header}>
            <h3 className={addItemModal.title}>
              <Target className={addItemModal.icon} />
              {mode === 'add' ? 'Track New Skill' : 'Edit Skill'}
            </h3>
            <button onClick={onClose} className={addItemModal.closeButton}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className={addItemModal.body}>
            <div className="grid grid-cols-1 lg:grid-cols-[180px_minmax(0,1fr)] gap-5">
              <div className="space-y-3">
                <label className={addItemModal.label}>Skill Image</label>
                <div className="aspect-square w-full rounded-[28px] overflow-hidden border border-border bg-background flex items-center justify-center">
                  {imageUrl.trim() ? (
                    <img src={imageUrl.trim()} alt={name || 'Skill image'} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted text-center px-4">
                      <ImageIcon className="w-8 h-8" />
                      <span className="text-xs font-bold uppercase tracking-wider">Image Preview</span>
                    </div>
                  )}
                </div>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.png"
                  className={addItemModal.smallInput}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <label className={addItemModal.label}>Skill Name</label>
                  <input
                    type="text"
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. English Lecture"
                    className={addItemModal.titleInput}
                  />
                </div>

                <div>
                  <label className={addItemModal.label}>Description</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Short description for this skill, course, or habit."
                    className={`${addItemModal.textarea} min-h-[100px]`}
                  />
                </div>

                <div>
                  <label className={addItemModal.label}>Manual Weekly Target (minutes)</label>
                  <input
                    type="number"
                    min="0"
                    value={weeklyTargetMinutes}
                    onChange={e => setWeeklyTargetMinutes(e.target.value)}
                    placeholder={schedule.enabled && derivedWeeklyTarget ? `${derivedWeeklyTarget} from schedule` : '300'}
                    className={addItemModal.input}
                  />
                  <p className={addItemModal.helpText}>When schedule is active, Arkaiv also derives the weekly target from session duration × sessions this week.</p>
                </div>
              </div>
            </div>

            <div className={addItemModal.sectionPanel}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                    <CalendarClock className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-primary">Schedule Skill Routine</h4>
                    <p className="text-xs text-muted">This creates a Focus routine saved with spreadsheet type “skills”.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSchedule(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider transition-colors ${schedule.enabled ? 'bg-indigo-600 text-white' : 'bg-background text-muted border border-border'}`}
                >
                  {schedule.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {schedule.enabled && (
                <div className="space-y-4 pt-2">
                  <div className={addItemModal.tabGroup}>
                    {intervals.map(interval => (
                      <button
                        key={interval}
                        onClick={() => setSchedule(prev => ({ ...prev, interval }))}
                        className={addItemModal.tabButton(schedule.interval === interval)}
                      >
                        {interval}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={addItemModal.label}>Start Time</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                        <input
                          type="time"
                          value={schedule.startTime}
                          onChange={e => setSchedule(prev => ({ ...prev, startTime: e.target.value }))}
                          className={`${addItemModal.input} pl-10`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={addItemModal.label}>End Time</label>
                      <input
                        type="time"
                        value={schedule.endTime}
                        onChange={e => setSchedule(prev => ({ ...prev, endTime: e.target.value }))}
                        className={addItemModal.input}
                      />
                    </div>
                  </div>

                  {schedule.interval === 'weekly' && (
                    <div>
                      <label className={addItemModal.label}>Days of Week</label>
                      <div className="grid grid-cols-7 gap-1.5">
                        {dayLabels.map((label, idx) => (
                          <button
                            key={`${label}-${idx}`}
                            type="button"
                            onClick={() => setSchedule(prev => ({ ...prev, daysOfWeek: toggleNumber(prev.daysOfWeek, idx) }))}
                            className={`h-9 rounded-xl text-xs font-bold border transition-colors ${schedule.daysOfWeek?.includes(idx) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-background border-border text-muted hover:border-indigo-500'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {schedule.interval === 'monthly' && (
                    <div>
                      <label className={addItemModal.label}>Dates of Month</label>
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => setSchedule(prev => ({ ...prev, daysOfMonth: toggleNumber(prev.daysOfMonth, day) }))}
                            className={`aspect-square rounded-lg text-[10px] font-bold border transition-colors ${schedule.daysOfMonth?.includes(day) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-background border-border text-muted hover:border-indigo-500'}`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {schedule.interval === 'yearly' && (
                    <div>
                      <label className={addItemModal.label}>Months</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {monthLabels.map((label, idx) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => setSchedule(prev => ({ ...prev, monthsOfYear: toggleNumber(prev.monthsOfYear, idx) }))}
                            className={`py-2 rounded-xl text-[10px] font-bold border uppercase transition-colors ${schedule.monthsOfYear?.includes(idx) ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-background border-border text-muted hover:border-indigo-500'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl bg-background border border-border p-4 text-sm text-muted">
                    Weekly target from this schedule: <span className="font-bold text-primary">{derivedWeeklyTarget} min</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={addItemModal.footer}>
            <button onClick={handleSave} disabled={!name.trim()} className={addItemModal.primaryButton}>
              <Check className="w-5 h-5" /> Save Skill
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SkillModal;
