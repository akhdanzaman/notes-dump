import { Type } from "@google/genai";
import { BrainDumpItem, BudgetConfig, Wallet, Skill, ItemType } from '../types';
import { getFinanceItems } from '../utils/selectors';
import { createGeminiClient, getGeminiKey, parseJsonResponse, withAiRetry, DEFAULT_FLASH_MODEL } from './aiService';
import { generateBehaviorDriftInsights } from '../utils/behaviorDrift';

const getCanonicalOrRaw = (
  item: BrainDumpItem,
  field: 'merchant' | 'paymentMethod' | 'commodity' | 'subcommodity'
) => item.meta.canonical?.[field]?.value || item.meta[field] || '';

export interface Insight {
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  iconType: 'finance' | 'task' | 'shopping' | 'skill';
}

export const generateAIInsights = async (
  items: BrainDumpItem[],
  budgetConfig: BudgetConfig,
  wallets: Wallet[],
  skills: Skill[],
  insightModel?: string
): Promise<Insight[]> => {
  const behaviorDrifts = generateBehaviorDriftInsights(items, skills, 3);
  const apiKey = getGeminiKey();
  const ai = createGeminiClient(apiKey);

  if (!ai || !apiKey) {
    return [
      ...behaviorDrifts,
      {
      type: 'warning',
      title: 'API Key Missing',
      message: 'Please configure your Gemini API key to get AI insights.',
      iconType: 'finance'
      }
    ];
  }

  const activeModel = insightModel || DEFAULT_FLASH_MODEL;
  
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();
  
  const lastMonthDate = new Date(now);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = lastMonthDate.getMonth();
  const lastYear = lastMonthDate.getFullYear();

  const getMonthExpenses = (month: number, year: number, upToDay: number) => {
    return items.filter(i => {
      if (i.type !== ItemType.FINANCE && i.type !== ItemType.SHOPPING && i.type !== ItemType.TODO) return false;
      if (i.status !== 'done') return false;
      const d = new Date(i.completed_at || i.meta.date || i.created_at);
      return d.getMonth() === month && d.getFullYear() === year && d.getDate() <= upToDay && (i.meta.amount || 0) > 0 && i.meta.financeType !== 'transfer' && i.meta.financeType !== 'income';
    });
  };

  const currentMonthExpenses = getMonthExpenses(currentMonth, currentYear, currentDay);
  const lastMonthExpenses = getMonthExpenses(lastMonth, lastYear, currentDay);

  const sumAmount = (arr: BrainDumpItem[]) => arr.reduce((sum, item) => sum + (item.meta.amount || 0), 0);
  const currentTotalExpense = sumAmount(currentMonthExpenses);
  const lastTotalExpense = sumAmount(lastMonthExpenses);

  const getTagBreakdown = (arr: BrainDumpItem[]) => {
    const breakdown: Record<string, { total: number, count: number, average: number }> = {};
    arr.forEach(item => {
      if (item.meta.tags) {
        item.meta.tags.forEach(tag => {
          if (!breakdown[tag]) breakdown[tag] = { total: 0, count: 0, average: 0 };
          breakdown[tag].total += (item.meta.amount || 0);
          breakdown[tag].count += 1;
        });
      }
    });
    Object.keys(breakdown).forEach(tag => {
      breakdown[tag].average = breakdown[tag].total / breakdown[tag].count;
    });
    return breakdown;
  };

  const currentTags = getTagBreakdown(currentMonthExpenses);
  const lastTags = getTagBreakdown(lastMonthExpenses);

  const getCanonicalBreakdown = (arr: BrainDumpItem[], field: 'merchant' | 'subcommodity') => {
    const breakdown: Record<string, { total: number; count: number }> = {};
    arr.forEach(item => {
      const key = getCanonicalOrRaw(item, field).trim();
      if (!key) return;
      if (!breakdown[key]) breakdown[key] = { total: 0, count: 0 };
      breakdown[key].total += item.meta.amount || 0;
      breakdown[key].count += 1;
    });
    return Object.entries(breakdown)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
      .map(([name, stats]) => ({ name, total: stats.total, count: stats.count }));
  };

  const incompleteLastMonth = items.filter(i => 
    (i.type === ItemType.TODO || i.type === ItemType.EVENT) && 
    i.status === 'pending' && 
    i.meta.date && 
    new Date(i.meta.date).getMonth() === lastMonth &&
    new Date(i.meta.date).getFullYear() === lastYear
  ).map(i => i.content);

  const completedTasksCurrentMonth = items.filter(i => 
    (i.type === ItemType.TODO || i.type === ItemType.EVENT) && 
    i.status === 'done' && 
    i.completed_at && 
    new Date(i.completed_at).getMonth() === currentMonth &&
    new Date(i.completed_at).getFullYear() === currentYear &&
    new Date(i.completed_at).getDate() <= currentDay
  ).length;

  const completedTasksLastMonth = items.filter(i => 
    (i.type === ItemType.TODO || i.type === ItemType.EVENT) && 
    i.status === 'done' && 
    i.completed_at && 
    new Date(i.completed_at).getMonth() === lastMonth &&
    new Date(i.completed_at).getFullYear() === lastYear &&
    new Date(i.completed_at).getDate() <= currentDay
  ).length;

  const { budgetMap, plannedBudgetMap, projectedExpense } = getFinanceItems(items, now, budgetConfig, '', '', '', '', '', '', '', 'newest');
  
  const budgetLimits = budgetConfig.rules.map(rule => ({
    category: rule.name,
    limit: (rule.percentage / 100) * budgetConfig.monthlyIncome,
    spent: budgetMap.get(rule.id) || 0,
    planned: plannedBudgetMap.get(rule.id) || 0
  }));

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - (24 * 60 * 60 * 1000);
  const sevenDaysAgo = todayStart - (7 * 24 * 60 * 60 * 1000);

  const recentItems = items.filter(i => {
      const d = new Date(i.created_at).getTime();
      return d >= sevenDaysAgo;
  });

  const yesterdayItems = recentItems.filter(i => {
      const d = new Date(i.created_at).getTime();
      return d >= yesterdayStart && d < todayStart;
  });

  const getSummaryStats = (arr: BrainDumpItem[]) => {
      return {
          expenses: arr.filter(i => i.type === ItemType.FINANCE && i.meta.financeType === 'expense').reduce((sum, i) => sum + (i.meta.amount || 0), 0),
          tasksCompleted: arr.filter(i => i.type === ItemType.TODO && i.status === 'done').length,
          tasksAdded: arr.filter(i => i.type === ItemType.TODO).length,
          shoppingItemsAdded: arr.filter(i => i.type === ItemType.SHOPPING).length,
          shoppingItemsBought: arr.filter(i => i.type === ItemType.SHOPPING && i.status === 'done').length,
          journalEntries: arr.filter(i => i.type === ItemType.JOURNAL).length,
          savingTransactions: arr.filter(i => i.type === ItemType.FINANCE && i.meta.financeType === 'saving').length,
      };
  };

  const skillProgress = skills.map(s => ({
      name: s.name,
      current: 0,
      target: s.weeklyTargetMinutes || 0,
      percentage: 0
  }));

  const savingGoals = items
      .filter(i => i.type === ItemType.SHOPPING && i.meta.shoppingCategory === 'saving')
      .map(goal => {
          const savedAmount = items
              .filter(i => i.type === ItemType.FINANCE && i.status === 'done' && i.meta.financeType === 'saving' && i.meta.savingGoalId === goal.id)
              .reduce((sum, item) => sum + (item.meta.amount || 0), 0);
          
          return {
              name: goal.content,
              current: savedAmount,
              target: goal.meta.amount || 0,
              percentage: goal.meta.amount ? Math.round((savedAmount / goal.meta.amount) * 100) : 0
          };
      });

  const dataSummary = {
    behaviorDrifts,
    yesterday: getSummaryStats(yesterdayItems),
    past7Days: getSummaryStats(recentItems),
    currentMonth: {
      daysElapsed: currentDay,
      dailyAverageExpense: currentTotalExpense / currentDay,
      totalExpense: currentTotalExpense,
      projectedTotalExpense: currentTotalExpense + projectedExpense,
      expenseByTag: currentTags,
      topCanonicalMerchants: getCanonicalBreakdown(currentMonthExpenses, 'merchant'),
      topCanonicalSubcommodities: getCanonicalBreakdown(currentMonthExpenses, 'subcommodity'),
      completedTasks: completedTasksCurrentMonth,
      dailyAverageTasks: completedTasksCurrentMonth / currentDay,
      skillProgress,
      savingGoals
    },
    lastMonth: {
      daysElapsed: currentDay,
      dailyAverageExpense: lastTotalExpense / currentDay,
      totalExpense: lastTotalExpense,
      expenseByTag: lastTags,
      topCanonicalMerchants: getCanonicalBreakdown(lastMonthExpenses, 'merchant'),
      topCanonicalSubcommodities: getCanonicalBreakdown(lastMonthExpenses, 'subcommodity'),
      completedTasks: completedTasksLastMonth,
      dailyAverageTasks: completedTasksLastMonth / currentDay,
      incompleteTasks: incompleteLastMonth
    },
    budget: {
      totalIncome: budgetConfig.monthlyIncome,
      categories: budgetLimits
    }
  };

  const prompt = `
    You are an AI assistant analyzing a user's personal productivity and finance data.
    Provide exactly 4 short, punchy, and actionable reviews based on the provided data.
    
    The 4 reviews MUST be:
    1. "Daily Review": Focus on yesterday's daily averages (budget, focus, goals, shopping, journal).
    2. "Weekly Review": Focus on the past 7 days trend.
    3. "Month over Month Review": Compare the current month's data (up to today) with last month's data (up to the same day).
    4. "General Review": A holistic overview or advice covering budget, focus, goals, shopping, journal, etc.
    
    CRITICAL RULES:
    1. DO NOT write paragraphs. Keep the message extremely short, punchy, and to the point (max 2 short sentences per review).
    2. Use specific numbers and tags provided.
    3. Cover ALL aspects: Budget, Focus (Tasks), Goals (Skills/Savings), Shopping, and Journaling.
    4. The 'title' field MUST be exactly one of: "Daily Review", "Weekly Review", "Month over Month Review", "General Review".
    5. If behaviorDrifts contains real changes, weave the biggest drift into the most relevant review instead of repeating static monthly summaries.
    
    Data Summary (Apple-to-Apple comparison up to day ${currentDay} of the month):
    ${JSON.stringify(dataSummary, null, 2)}
  `;

  try {
    const response = await withAiRetry(() => ai.models.generateContent({
      model: activeModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, description: "One of: warning, info, success" },
              title: { type: Type.STRING },
              message: { type: Type.STRING },
              iconType: { type: Type.STRING, description: "One of: finance, task, shopping, skill" }
            },
            required: ["type", "title", "message", "iconType"]
          }
        }
      }
    }));

    const parsed = parseJsonResponse<Insight[]>(response.text, []);
    return Array.isArray(parsed) ? [...behaviorDrifts, ...parsed] : behaviorDrifts;
  } catch (error) {
    console.error("Failed to generate AI insights:", error);
    return behaviorDrifts;
  }
};
