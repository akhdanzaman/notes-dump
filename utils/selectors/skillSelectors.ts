import { BrainDumpItem, ItemType, Skill } from '../../types';

const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    d.setHours(0, 0, 0, 0);
    return new Date(d.setDate(diff));
};

export const getSkillItems = (items: BrainDumpItem[], skills: Skill[]) => {
    const logs: BrainDumpItem[] = [];

    const stats = skills.map(skill => ({
        ...skill,
        totalHours: 0,
        weeklyHours: 0,
        weeklyProgress: 0
    })).sort((a,b) => b.name.localeCompare(a.name));

    return { stats, logs };
};
