import { BrainDumpItem, ItemType, Skill } from '../../types';

const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    d.setHours(0, 0, 0, 0);
    return new Date(d.setDate(diff));
};

export const getSkillItems = (items: BrainDumpItem[], skills: Skill[]) => {
    const logs = items.filter(i => i.type === ItemType.SKILL_LOG).sort((a, b) => {
        const da = new Date(a.meta.date || a.created_at).getTime();
        const db = new Date(b.meta.date || b.created_at).getTime();
        return db - da; 
    });

    const skillStats = new Map<string, number>(); // All time
    const weeklyStats = new Map<string, number>(); // Current Week

    const startOfWeek = getStartOfWeek(new Date());

    skills.forEach(s => {
        skillStats.set(s.id, 0);
        weeklyStats.set(s.id, 0);
    });

    items.filter(i => i.type === ItemType.SKILL_LOG).forEach(log => {
        const duration = log.meta.durationMinutes || 0;
        const sId = log.meta.skillId;
        const logDate = new Date(log.meta.date || log.created_at);

        if (sId) {
           // Total
           skillStats.set(sId, (skillStats.get(sId) || 0) + duration);
           
           // Weekly
           if (logDate >= startOfWeek) {
               weeklyStats.set(sId, (weeklyStats.get(sId) || 0) + duration);
           }
        }
    });

    const stats = skills.map(skill => ({
        ...skill,
        totalHours: Math.round(((skillStats.get(skill.id) || 0) / 60) * 10) / 10,
        weeklyHours: Math.round(((weeklyStats.get(skill.id) || 0) / 60) * 10) / 10,
        weeklyProgress: skill.weeklyTargetMinutes 
          ? Math.min(100, ( (weeklyStats.get(skill.id) || 0) / skill.weeklyTargetMinutes ) * 100)
          : 0
    })).sort((a,b) => b.totalHours - a.totalHours);

    return { stats, logs: logs.slice(0, 10) };
};
