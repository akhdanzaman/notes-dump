export const getLocalISOString = (date: Date = new Date()): string => {
    const tzo = -date.getTimezoneOffset(),
        dif = tzo >= 0 ? '+' : '-',
        pad = function(num: number) {
            return (num < 10 ? '0' : '') + num;
        };
    return date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) +
        ':' + pad(date.getMinutes()) +
        ':' + pad(date.getSeconds()) +
        dif + pad(Math.floor(Math.abs(tzo) / 60)) +
        ':' + pad(Math.abs(tzo) % 60);
};



const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const getLocalDayStart = (date: Date): Date =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const isSameLocalDay = (a: Date, b: Date): boolean =>
    getLocalDayStart(a).getTime() === getLocalDayStart(b).getTime();

export const isBeforeLocalDay = (a: Date, b: Date): boolean =>
    getLocalDayStart(a).getTime() < getLocalDayStart(b).getTime();

export const isAfterLocalDay = (a: Date, b: Date): boolean =>
    getLocalDayStart(a).getTime() > getLocalDayStart(b).getTime();

export const calculateNextDueDate = (
    completedDate: Date,
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly',
    daysOfWeek: number[] = [],
    daysOfMonth: number[] = [],
    monthsOfYear: number[] = []
): Date => {
    let nextDueTime = completedDate.getTime();
    
    if (interval === 'daily') {
        nextDueTime = completedDate.getTime() + (1 * 24 * 60 * 60 * 1000);
    } 
    else if (interval === 'weekly') {
        if (daysOfWeek.length > 0) {
            const currentDay = completedDate.getDay(); // 0-6
            const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
            const nextDay = sortedDays.find(d => d > currentDay);
            
            if (nextDay !== undefined) {
                const daysToAdd = nextDay - currentDay;
                nextDueTime = completedDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000);
            } else {
                const firstDay = sortedDays[0];
                const daysToAdd = (7 - currentDay) + firstDay;
                nextDueTime = completedDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000);
            }
        } else {
             nextDueTime = completedDate.getTime() + (7 * 24 * 60 * 60 * 1000);
        }
    }
    else if (interval === 'monthly') {
        if (daysOfMonth.length > 0) {
            const sortedDays = [...daysOfMonth].sort((a, b) => a - b);
            for (let monthOffset = 0; monthOffset <= 24; monthOffset++) {
                const year = completedDate.getFullYear();
                const month = completedDate.getMonth() + monthOffset;
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                for (const selectedDay of sortedDays) {
                    const clampedDay = Math.min(selectedDay, daysInMonth);
                    const candidate = new Date(
                        year,
                        month,
                        clampedDay,
                        completedDate.getHours(),
                        completedDate.getMinutes(),
                        completedDate.getSeconds(),
                        completedDate.getMilliseconds()
                    );
                    if (candidate.getTime() > completedDate.getTime()) {
                        nextDueTime = candidate.getTime();
                        monthOffset = 25;
                        break;
                    }
                }
            }
        } else {
            nextDueTime = completedDate.getTime() + (30 * 24 * 60 * 60 * 1000);
        }
    }
    else if (interval === 'yearly') {
        if (monthsOfYear.length > 0) {
            const currentMonth = completedDate.getMonth(); // 0-11
            const sortedMonths = [...monthsOfYear].sort((a, b) => a - b);
            const nextMonth = sortedMonths.find(m => m > currentMonth);
            
            const nextDateObj = new Date(completedDate);
            if (nextMonth !== undefined) {
                nextDateObj.setMonth(nextMonth);
                nextDateObj.setDate(1); 
            } else {
                nextDateObj.setFullYear(nextDateObj.getFullYear() + 1);
                nextDateObj.setMonth(sortedMonths[0]);
                nextDateObj.setDate(1);
            }
            nextDueTime = nextDateObj.getTime();
        } else {
            nextDueTime = completedDate.getTime() + (365 * 24 * 60 * 60 * 1000);
        }
    }
    
    return new Date(nextDueTime);
};


export const advanceRoutineDueDateToTodayOrFuture = (
    dueDate: Date,
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly',
    daysOfWeek: number[] = [],
    daysOfMonth: number[] = [],
    monthsOfYear: number[] = [],
    now: Date = new Date()
): Date => {
    let candidate = new Date(dueDate);
    if (Number.isNaN(candidate.getTime())) return new Date(now);

    const todayStart = getLocalDayStart(now).getTime();
    let guard = 0;

    while (getLocalDayStart(candidate).getTime() < todayStart && guard < 500) {
        const next = calculateNextDueDate(candidate, interval, daysOfWeek, daysOfMonth, monthsOfYear);
        if (Number.isNaN(next.getTime()) || next.getTime() <= candidate.getTime()) {
            candidate = new Date(candidate.getTime() + ONE_DAY_MS);
        } else {
            candidate = next;
        }
        guard += 1;
    }

    return candidate;
};

export const advanceRecurringDueDateByDaysToTodayOrFuture = (
    dueDate: Date,
    recurrenceDays: number = 1,
    now: Date = new Date()
): Date => {
    const days = Math.max(Number(recurrenceDays || 1), 1);
    let candidate = new Date(dueDate);
    if (Number.isNaN(candidate.getTime())) return new Date(now);

    const todayStart = getLocalDayStart(now).getTime();
    let guard = 0;

    while (getLocalDayStart(candidate).getTime() < todayStart && guard < 500) {
        candidate = new Date(candidate.getTime() + (days * ONE_DAY_MS));
        guard += 1;
    }

    return candidate;
};

export const calculateFirstDueDate = (
    fromDate: Date,
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly',
    daysOfWeek: number[] = [],
    daysOfMonth: number[] = [],
    monthsOfYear: number[] = []
): Date => {
    let nextDueTime = fromDate.getTime();
    
    if (interval === 'daily') {
        // Starts today
        return fromDate;
    } 
    else if (interval === 'weekly') {
        if (daysOfWeek.length > 0) {
            const currentDay = fromDate.getDay(); // 0-6
            const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
            // Find today or future day in same week
            const nextDay = sortedDays.find(d => d >= currentDay);
            
            if (nextDay !== undefined) {
                const daysToAdd = nextDay - currentDay;
                nextDueTime = fromDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000);
            } else {
                // Wrap to next week
                const firstDay = sortedDays[0];
                const daysToAdd = (7 - currentDay) + firstDay;
                nextDueTime = fromDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000);
            }
        }
    }
    else if (interval === 'monthly') {
        if (daysOfMonth.length > 0) {
            const sortedDays = [...daysOfMonth].sort((a, b) => a - b);
            for (let monthOffset = 0; monthOffset <= 24; monthOffset++) {
                const year = fromDate.getFullYear();
                const month = fromDate.getMonth() + monthOffset;
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                for (const selectedDay of sortedDays) {
                    const clampedDay = Math.min(selectedDay, daysInMonth);
                    const candidate = new Date(
                        year,
                        month,
                        clampedDay,
                        fromDate.getHours(),
                        fromDate.getMinutes(),
                        fromDate.getSeconds(),
                        fromDate.getMilliseconds()
                    );
                    if (candidate.getTime() >= fromDate.getTime()) {
                        nextDueTime = candidate.getTime();
                        monthOffset = 25;
                        break;
                    }
                }
            }
        }
    }
    else if (interval === 'yearly') {
        if (monthsOfYear.length > 0) {
            const currentMonth = fromDate.getMonth(); // 0-11
            const sortedMonths = [...monthsOfYear].sort((a, b) => a - b);
            // Check if current month is in list, if so, check if day is passed? 
            // Usually yearly is just "in this month". Let's assume 1st of month for simplicity or today if same month.
            
            const nextMonth = sortedMonths.find(m => m >= currentMonth);
            
            const nextDateObj = new Date(fromDate);
            if (nextMonth !== undefined) {
                if (nextMonth > currentMonth) {
                    nextDateObj.setMonth(nextMonth);
                    nextDateObj.setDate(1);
                } else {
                    // Same month, so it's today (or we could check days if we had them, but we don't for yearly)
                    // Let's assume if it's the same month, it's due "this month", so "now" is fine.
                }
            } else {
                // Next year
                nextDateObj.setFullYear(nextDateObj.getFullYear() + 1);
                nextDateObj.setMonth(sortedMonths[0]);
                nextDateObj.setDate(1);
            }
            nextDueTime = nextDateObj.getTime();
        }
    }
    
    return new Date(nextDueTime);
};

export const getRoutineScheduleLabel = (
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'daily',
    daysOfWeek: number[] = [],
    daysOfMonth: number[] = [],
    monthsOfYear: number[] = [],
    recurrenceDays: number = 1
): string => {
    if (interval === 'daily') {
        return recurrenceDays > 1 ? `Every ${recurrenceDays} Days` : 'Every Day';
    }
    
    if (interval === 'weekly') {
        if (!daysOfWeek || daysOfWeek.length === 0) return `Every ${recurrenceDays > 1 ? recurrenceDays + ' ' : ''}Week${recurrenceDays > 1 ? 's' : ''}`;
        
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const selectedDays = daysOfWeek
            .sort((a, b) => a - b)
            .map(d => dayNames[d]);
            
        return `Every ${selectedDays.join(', ')}`;
    }
    
    if (interval === 'monthly') {
        if (!daysOfMonth || daysOfMonth.length === 0) return `Every ${recurrenceDays > 1 ? recurrenceDays + ' ' : ''}Month${recurrenceDays > 1 ? 's' : ''}`;
        
        const selectedDates = daysOfMonth.sort((a, b) => a - b).map(d => {
            const lastDigit = d % 10;
            const suffix = (d >= 11 && d <= 13) ? 'th' : (lastDigit === 1 ? 'st' : (lastDigit === 2 ? 'nd' : (lastDigit === 3 ? 'rd' : 'th')));
            return `${d}${suffix}`;
        });
        
        return `Monthly on ${selectedDates.join(', ')}`;
    }
    
    if (interval === 'yearly') {
        if (!monthsOfYear || monthsOfYear.length === 0) return `Every ${recurrenceDays > 1 ? recurrenceDays + ' ' : ''}Year${recurrenceDays > 1 ? 's' : ''}`;
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const selectedMonths = monthsOfYear
            .sort((a, b) => a - b)
            .map(m => monthNames[m]);
            
        return `Yearly in ${selectedMonths.join(', ')}`;
    }
    
    return 'Routine';
};
