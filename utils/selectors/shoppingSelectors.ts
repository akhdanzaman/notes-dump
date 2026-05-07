import { BrainDumpItem, ItemType } from '../../types';
import { getShoppingCreatedSortTime, getShoppingDueSortTime } from '../shoppingDateUtils';

export const getShoppingItems = (items: BrainDumpItem[]) => {
    const visibleItems = items.filter(i => {
        if (i.type !== ItemType.SHOPPING) return false;
        if (i.status === 'pending') return true;
        if (i.status === 'done' && i.meta?.shoppingCategory === 'routine') return true;
        if (i.status === 'done' && i.meta?.shoppingCategory === 'saving') return true; // Keep savings visible even if done
        if (i.status === 'done' && i.meta?.shoppingCategory === 'investment') return true; // Keep investment positions visible even if marked archived/done
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
    const withSavedAmount = (target: BrainDumpItem) => {
        const savedAmount = items
            .filter(i => i.type === ItemType.FINANCE && i.status === 'done' && i.meta.financeType === 'saving' && i.meta.savingGoalId === target.id)
            .reduce((sum, item) => sum + (item.meta.amount || 0), 0);
        return { ...target, meta: { ...target.meta, savedAmount } };
    };

    const savings = visibleItems.filter(i => i.meta?.shoppingCategory === 'saving').map(withSavedAmount);
    const investments = visibleItems.filter(i => i.meta?.shoppingCategory === 'investment').map(withSavedAmount);
    const normal = visibleItems.filter(i => !i.meta?.shoppingCategory || i.meta.shoppingCategory === 'not_urgent');

    const sortFn = (a: BrainDumpItem, b: BrainDumpItem) => {
        if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
        const da = getShoppingDueSortTime(a);
        const db = getShoppingDueSortTime(b);
        if (da !== db) return da - db;
        return getShoppingCreatedSortTime(a) - getShoppingCreatedSortTime(b);
    };

    urgent.sort(sortFn);
    routine.sort(sortFn);
    normal.sort(sortFn);
    savings.sort(sortFn);
    investments.sort(sortFn);

    return { urgent, routine, normal, savings, investments };
};
