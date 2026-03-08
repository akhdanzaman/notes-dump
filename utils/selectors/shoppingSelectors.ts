import { BrainDumpItem, ItemType } from '../../types';

export const getShoppingItems = (items: BrainDumpItem[]) => {
    const visibleItems = items.filter(i => {
        if (i.type !== ItemType.SHOPPING) return false;
        if (i.status === 'pending') return true;
        if (i.status === 'done' && i.meta?.shoppingCategory === 'routine') return true;
        if (i.status === 'done' && i.meta?.shoppingCategory === 'saving') return true; // Keep savings visible even if done
        if (i.status === 'done' && i.completed_at) {
            const completedTime = new Date(i.completed_at).getTime();
            const now = new Date().getTime();
            const oneDayMs = 24 * 60 * 60 * 1000;
            return (now - completedTime) < oneDayMs;
        }
        return false;
    });
    
    const urgent = visibleItems.filter(i => i.meta?.shoppingCategory === 'urgent');
    const routine = visibleItems.filter(i => i.meta?.shoppingCategory === 'routine');
    const savings = visibleItems.filter(i => i.meta?.shoppingCategory === 'saving').map(goal => {
        const savedAmount = items
            .filter(i => i.type === ItemType.FINANCE && i.status === 'done' && i.meta.financeType === 'saving' && i.meta.savingGoalId === goal.id)
            .reduce((sum, item) => sum + (item.meta.amount || 0), 0);
        return { ...goal, meta: { ...goal.meta, savedAmount } };
    });
    const normal = visibleItems.filter(i => !i.meta?.shoppingCategory || i.meta.shoppingCategory === 'not_urgent');

    const sortFn = (a: BrainDumpItem, b: BrainDumpItem) => {
        if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
        const da = a.meta.date ? new Date(a.meta.date).getTime() : 0;
        const db = b.meta.date ? new Date(b.meta.date).getTime() : 0;
        return da - db;
    };

    urgent.sort(sortFn);
    routine.sort(sortFn);
    normal.sort(sortFn);
    savings.sort(sortFn);

    return { urgent, routine, normal, savings };
};
