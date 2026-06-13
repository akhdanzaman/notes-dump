import { BrainDumpItem, ItemType, Skill, SkillSchedule } from '../../types';

export type SkillScheduleSession = {
  skillId: string;
  skillName: string;
  date: Date;
  start: Date;
  end: Date;
  durationMinutes: number;
};

const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setHours(0, 0, 0, 0);
  return new Date(d.setDate(diff));
};

const getEndOfWeek = (date: Date) => {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return end;
};

const parseTime = (value?: string) => {
  const [hourRaw, minuteRaw] = String(value || '').split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  return {
    hour: Number.isFinite(hour) ? Math.min(Math.max(hour, 0), 23) : 9,
    minute: Number.isFinite(minute) ? Math.min(Math.max(minute, 0), 59) : 0,
  };
};

const formatTimeFromDate = (value?: string, fallback = '09:00') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const addMinutesToTime = (time: string, minutes: number) => {
  const { hour, minute } = parseTime(time);
  const total = (((hour * 60 + minute + Math.max(minutes, 1)) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const setTime = (date: Date, time?: string) => {
  const next = new Date(date);
  const { hour, minute } = parseTime(time);
  next.setHours(hour, minute, 0, 0);
  return next;
};

export const getSkillScheduleDurationMinutes = (schedule?: SkillSchedule) => {
  if (!schedule?.enabled) return 0;
  const start = parseTime(schedule.startTime);
  const end = parseTime(schedule.endTime);
  let startMinutes = start.hour * 60 + start.minute;
  let endMinutes = end.hour * 60 + end.minute;
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return Math.max(endMinutes - startMinutes, 1);
};

const scheduleMatchesDate = (schedule: SkillSchedule, date: Date) => {
  if (!schedule.enabled) return false;

  if (schedule.interval === 'daily') return true;

  if (schedule.interval === 'weekly') {
    const days = schedule.daysOfWeek?.length ? schedule.daysOfWeek : [date.getDay()];
    return days.includes(date.getDay());
  }

  if (schedule.interval === 'monthly') {
    const days = schedule.daysOfMonth?.length ? schedule.daysOfMonth : [date.getDate()];
    return days.includes(date.getDate());
  }

  if (schedule.interval === 'yearly') {
    const months = schedule.monthsOfYear?.length ? schedule.monthsOfYear : [date.getMonth()];
    return months.includes(date.getMonth()) && date.getDate() === 1;
  }

  return false;
};

const isRoutineSkillItem = (item: BrainDumpItem, skill: Pick<Skill, 'id' | 'name'>) => {
  if (item.type !== ItemType.SKILLS || !item.meta.isRoutine) return false;
  if (item.meta.skillId && item.meta.skillId === skill.id) return true;
  if (item.meta.skillName && item.meta.skillName.toLowerCase() === skill.name.toLowerCase()) return true;
  return !item.meta.skillId && item.content.toLowerCase() === skill.name.toLowerCase();
};

const scheduleFromRoutineItem = (item: BrainDumpItem): SkillSchedule | undefined => {
  const interval = item.meta.routineInterval;
  if (!interval) return undefined;

  const startTime = formatTimeFromDate(item.meta.start || item.meta.date, '09:00');
  const endTime = item.meta.end
    ? formatTimeFromDate(item.meta.end, addMinutesToTime(startTime, Number(item.meta.durationMinutes) || 60))
    : addMinutesToTime(startTime, Number(item.meta.durationMinutes) || 60);

  return {
    enabled: true,
    interval,
    daysOfWeek: interval === 'weekly' ? item.meta.routineDaysOfWeek : undefined,
    daysOfMonth: interval === 'monthly' ? item.meta.routineDaysOfMonth : undefined,
    monthsOfYear: interval === 'yearly' ? item.meta.routineMonthsOfYear : undefined,
    startTime,
    endTime,
  };
};

const resolveSkillSchedule = (skill: Skill, items: BrainDumpItem[]): SkillSchedule | undefined => {
  if (skill.schedule) return skill.schedule;
  const routineItem = items.find(item => isRoutineSkillItem(item, skill));
  return routineItem ? scheduleFromRoutineItem(routineItem) : undefined;
};

export const getSkillScheduleSessionsForWeek = (
  skill: Pick<Skill, 'id' | 'name' | 'schedule'>,
  baseDate: Date = new Date(),
): SkillScheduleSession[] => {
  const schedule = skill.schedule;
  if (!schedule?.enabled) return [];

  const startOfWeek = getStartOfWeek(baseDate);
  const durationMinutes = getSkillScheduleDurationMinutes(schedule);
  const sessions: SkillScheduleSession[] = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + offset);
    if (!scheduleMatchesDate(schedule, day)) continue;

    const start = setTime(day, schedule.startTime);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    sessions.push({
      skillId: skill.id,
      skillName: skill.name,
      date: day,
      start,
      end,
      durationMinutes,
    });
  }

  return sessions;
};

export const getNextSkillScheduleStart = (schedule: SkillSchedule, fromDate: Date = new Date()) => {
  const candidate = new Date(fromDate);
  candidate.setSeconds(0, 0);

  for (let offset = 0; offset <= 370; offset += 1) {
    const day = new Date(candidate);
    day.setDate(candidate.getDate() + offset);
    const start = setTime(day, schedule.startTime);
    if (scheduleMatchesDate(schedule, start) && start.getTime() >= fromDate.getTime()) {
      return start;
    }
  }

  return setTime(candidate, schedule.startTime);
};

export const getSkillItems = (items: BrainDumpItem[], skills: Skill[]) => {
  const logs = items
    .filter(i => i.type === ItemType.SKILL_LOG)
    .sort((a, b) => new Date(b.meta.date || b.completed_at || b.created_at).getTime() - new Date(a.meta.date || a.completed_at || a.created_at).getTime());

  const weekStart = getStartOfWeek(new Date());
  const weekEnd = getEndOfWeek(new Date());

  const stats = skills.map(skill => {
    const schedule = resolveSkillSchedule(skill, items);
    const skillWithResolvedSchedule = { ...skill, schedule };
    const skillLogs = logs.filter(log =>
      (log.meta.skillId && log.meta.skillId === skill.id) ||
      (!log.meta.skillId && log.meta.skillName?.toLowerCase() === skill.name.toLowerCase())
    );

    const totalMinutes = skillLogs.reduce((sum, log) => sum + (Number(log.meta.durationMinutes) || 0), 0);
    const weeklyMinutes = skillLogs
      .filter(log => {
        const logDate = new Date(log.meta.date || log.completed_at || log.created_at);
        return logDate >= weekStart && logDate < weekEnd;
      })
      .reduce((sum, log) => sum + (Number(log.meta.durationMinutes) || 0), 0);

    const scheduleSessions = getSkillScheduleSessionsForWeek(skillWithResolvedSchedule);
    const scheduleWeeklyTargetMinutes = scheduleSessions.reduce((sum, session) => sum + session.durationMinutes, 0);
    const effectiveWeeklyTargetMinutes = schedule?.enabled
      ? scheduleWeeklyTargetMinutes
      : (skill.weeklyTargetMinutes || 0);

    return {
      ...skillWithResolvedSchedule,
      totalMinutes,
      totalHours: totalMinutes / 60,
      weeklyMinutes,
      weeklyHours: weeklyMinutes / 60,
      weeklyProgress: effectiveWeeklyTargetMinutes ? Math.min(100, (weeklyMinutes / effectiveWeeklyTargetMinutes) * 100) : 0,
      effectiveWeeklyTargetMinutes,
      scheduleWeeklyTargetMinutes,
      scheduleSessions,
    };
  }).sort((a, b) => b.name.localeCompare(a.name));

  return { logs, stats };
};
