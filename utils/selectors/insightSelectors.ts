import { BrainDumpItem, ItemType, BudgetConfig, Wallet, Skill } from '../../types';
import { getFinanceItems, getWalletStats } from './moneySelectors';
import { getShoppingItems } from './shoppingSelectors';
import { getSkillItems } from './skillSelectors';
import { generateBehaviorDriftInsights } from '../behaviorDrift';

export interface Insight {
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  iconType: 'finance' | 'task' | 'shopping' | 'skill';
}

export const generateInsights = (
  items: BrainDumpItem[],
  budgetConfig: BudgetConfig,
  wallets: Wallet[],
  skills: Skill[]
): Insight[] => {
  const insights: Insight[] = [];
  const behaviorDrifts = generateBehaviorDriftInsights(items, skills, 3);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  // 1. Finance Insights
  const thisMonthFinance = getFinanceItems(items, now, budgetConfig, '', '', '', '', '', '', '', 'newest');
  const lastMonthFinance = getFinanceItems(items, lastMonthStart, budgetConfig, '', '', '', '', '', '', '', 'newest');

  const totalLimits = budgetConfig.rules.reduce((acc, rule) => acc + (rule.percentage / 100) * budgetConfig.monthlyIncome, 0);
  if (totalLimits > 0) {
    const budgetPercent = (thisMonthFinance.totalExpense / totalLimits) * 100;
    if (budgetPercent >= 90) {
      insights.push({
        type: 'warning',
        title: 'Budget Critical',
        message: `You have used ${budgetPercent.toFixed(0)}% of your monthly budget.`,
        iconType: 'finance'
      });
    } else if (budgetPercent >= 75) {
      insights.push({
        type: 'warning',
        title: 'Budget Warning',
        message: `You have used ${budgetPercent.toFixed(0)}% of your monthly budget. Watch your spending.`,
        iconType: 'finance'
      });
    }
  }

  // Compare total expenses
  if (thisMonthFinance.totalExpense > lastMonthFinance.totalExpense && lastMonthFinance.totalExpense > 0) {
    const diff = thisMonthFinance.totalExpense - lastMonthFinance.totalExpense;
    const percent = (diff / lastMonthFinance.totalExpense) * 100;
    if (percent > 20) {
      insights.push({
        type: 'warning',
        title: 'Higher Spending',
        message: `Your spending this month is ${percent.toFixed(0)}% higher than last month.`,
        iconType: 'finance'
      });
    }
  } else if (thisMonthFinance.totalExpense < lastMonthFinance.totalExpense * 0.5 && now.getDate() > 20) {
      insights.push({
        type: 'success',
        title: 'Great Savings',
        message: `Your spending is significantly lower than last month. Keep it up!`,
        iconType: 'finance'
      });
  }

  // Compare categories
  thisMonthFinance.budgetMap.forEach((amount, catId) => {
    const lastMonthAmount = lastMonthFinance.budgetMap.get(catId) || 0;
    if (lastMonthAmount > 0 && amount > lastMonthAmount * 1.5) {
      const rule = budgetConfig.rules.find(r => r.id === catId);
      if (rule) {
        insights.push({
          type: 'warning',
          title: 'Category Spike',
          message: `Spending on ${rule.name} is significantly higher than last month (${fmt(amount)} vs ${fmt(lastMonthAmount)}).`,
          iconType: 'finance'
        });
      }
    }
  });

  // Tag-based spending
  const getTagSpending = (start: Date, end: Date) => {
    const tagMap = new Map<string, number>();
    items.forEach(i => {
      const isExpense = i.type === ItemType.FINANCE && i.meta.financeType === 'expense';
      const isImplicitExpense = (i.type === ItemType.SHOPPING || i.type === ItemType.TODO) && i.status === 'done' && !i.meta.isRoutine;
      
      if ((isExpense || isImplicitExpense) && i.meta.amount) {
        const d = new Date(i.completed_at || i.meta.date || i.created_at);
        if (d >= start && d <= end) {
          i.meta.tags?.forEach(tag => {
            tagMap.set(tag, (tagMap.get(tag) || 0) + i.meta.amount!);
          });
        }
      }
    });
    return tagMap;
  };

  const lastMonthTags = getTagSpending(lastMonthStart, lastMonthEnd);
  const thisMonthTags = getTagSpending(thisMonthStart, now);

  thisMonthTags.forEach((amount, tag) => {
    const lastAmount = lastMonthTags.get(tag) || 0;
    if (lastAmount > 0 && amount > lastAmount * 1.5 && amount > 50000) {
      insights.push({
        type: 'warning',
        title: 'Tag Spending Spike',
        message: `Spending on tag "#${tag}" is significantly higher this month (${fmt(amount)}) compared to last month (${fmt(lastAmount)}).`,
        iconType: 'finance'
      });
    }
  });

  const { walletStats } = getWalletStats(items, wallets);
  walletStats.forEach(w => {
    if (w.type !== 'cc' && w.currentBalance < w.initialBalance * 0.1 && w.currentBalance > 0) {
      insights.push({
        type: 'warning',
        title: 'Low Balance',
        message: `Wallet "${w.name}" is running low (${fmt(w.currentBalance)}).`,
        iconType: 'finance'
      });
    } else if (w.type !== 'cc' && w.currentBalance <= 0) {
      insights.push({
        type: 'warning',
        title: 'Empty Wallet',
        message: `Wallet "${w.name}" is empty or overdrawn.`,
        iconType: 'finance'
      });
    }
  });

  // 2. Task Insights
  const pendingTasks = items.filter(i => (i.type === ItemType.TODO || i.type === ItemType.EVENT) && i.status === 'pending');
  const overdueTasks = pendingTasks.filter(i => {
    if (!i.meta.date) return false;
    const d = new Date(i.meta.date).getTime();
    return d < todayStart && !i.meta.isRoutine;
  });

  if (overdueTasks.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Overdue Tasks',
      message: `You have ${overdueTasks.length} overdue task(s). Consider rescheduling or dropping them.`,
      iconType: 'task'
    });
  }

  const unfulfilledLastMonth = items.filter(i => {
    if ((i.type === ItemType.TODO || i.type === ItemType.EVENT || i.type === ItemType.SHOPPING) && i.status === 'pending') {
      if (!i.meta.date) return false;
      const d = new Date(i.meta.date);
      return d >= lastMonthStart && d <= lastMonthEnd && !i.meta.isRoutine;
    }
    return false;
  });

  if (unfulfilledLastMonth.length > 0) {
    const taskCount = unfulfilledLastMonth.filter(i => i.type === ItemType.TODO || i.type === ItemType.EVENT).length;
    const shopCount = unfulfilledLastMonth.filter(i => i.type === ItemType.SHOPPING).length;
    
    let msgParts = [];
    if (taskCount > 0) msgParts.push(`${taskCount} tasks`);
    if (shopCount > 0) msgParts.push(`${shopCount} shopping items`);
    
    insights.push({
      type: 'info',
      title: 'Unfinished Business',
      message: `You have ${msgParts.join(' and ')} from last month that are still pending. Consider dropping or rescheduling them.`,
      iconType: taskCount > 0 ? 'task' : 'shopping'
    });
  }

  const getCompletionRate = (start: Date, end: Date) => {
    const periodItems = items.filter(i => {
      if (i.type !== ItemType.TODO) return false;
      const d = new Date(i.meta.date || i.created_at);
      return d >= start && d <= end && !i.meta.isRoutine;
    });
    const done = periodItems.filter(i => i.status === 'done').length;
    return periodItems.length > 0 ? done / periodItems.length : null;
  };

  const lastMonthRate = getCompletionRate(lastMonthStart, lastMonthEnd);
  const thisMonthRate = getCompletionRate(thisMonthStart, now);

  if (lastMonthRate !== null && thisMonthRate !== null && thisMonthRate > lastMonthRate + 0.2) {
    insights.push({
      type: 'success',
      title: 'Productivity Boost',
      message: `Great job! Your task completion rate is ${(thisMonthRate*100).toFixed(0)}% this month, up from ${(lastMonthRate*100).toFixed(0)}% last month.`,
      iconType: 'task'
    });
  } else if (lastMonthRate !== null && thisMonthRate !== null && thisMonthRate < lastMonthRate - 0.2 && thisMonthRate < 0.5) {
     insights.push({
      type: 'warning',
      title: 'Productivity Dip',
      message: `Your task completion rate is ${(thisMonthRate*100).toFixed(0)}% this month, down from ${(lastMonthRate*100).toFixed(0)}% last month.`,
      iconType: 'task'
    });
  }

  const todayTasks = pendingTasks.filter(i => {
    if (!i.meta.date) return false;
    const d = new Date(i.meta.date).getTime();
    return d >= todayStart && d < todayStart + 86400000;
  });

  if (todayTasks.length > 5) {
    insights.push({
      type: 'info',
      title: 'Heavy Workload',
      message: `You have ${todayTasks.length} tasks scheduled for today. Make sure to prioritize.`,
      iconType: 'task'
    });
  } else if (todayTasks.length === 0 && overdueTasks.length === 0) {
    insights.push({
      type: 'success',
      title: 'Clear Schedule',
      message: `No tasks scheduled for today. Enjoy your free time or plan ahead!`,
      iconType: 'task'
    });
  }

  // 3. Shopping Insights
  const { urgent } = getShoppingItems(items);
  if (urgent.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Urgent Purchases',
      message: `You have ${urgent.length} urgent item(s) to buy.`,
      iconType: 'shopping'
    });
  }

  // 4. Skill Insights
  const { stats } = getSkillItems(items, skills);
  const neglectedSkills = stats.filter(s => s.weeklyTargetMinutes && s.weeklyTargetMinutes > 0 && s.weeklyProgress === 0);
  if (neglectedSkills.length > 0) {
    insights.push({
      type: 'info',
      title: 'Skill Practice',
      message: `You haven't practiced ${neglectedSkills.map(s => s.name).join(', ')} this week.`,
      iconType: 'skill'
    });
  }

  return [...behaviorDrifts, ...insights];
};
