import { GoogleGenAI, Type } from "@google/genai";
import { BrainDumpItem, BudgetConfig, Wallet, Skill, ItemType } from '../types';
import { getGeminiKey } from './geminiService';
import { getFinanceItems } from '../utils/selectors';

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
  skills: Skill[]
): Promise<Insight[]> => {
  const apiKey = getGeminiKey();
  if (!apiKey) {
    return [{
      type: 'warning',
      title: 'API Key Missing',
      message: 'Please configure your Gemini API key to get AI insights.',
      iconType: 'finance'
    }];
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Aggregate data
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();
  
  const lastMonthDate = new Date(now);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonth = lastMonthDate.getMonth();
  const lastYear = lastMonthDate.getFullYear();

  // Finance aggregation (Apple to Apple: up to current day)
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

  // Tasks aggregation (Apple to Apple: up to current day)
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

  // Budget and Planned Spending (Current Month)
  const { budgetMap, plannedBudgetMap, projectedExpense } = getFinanceItems(items, now, budgetConfig, '', '', '', '', '', '', '', 'newest');
  
  const budgetLimits = budgetConfig.rules.map(rule => ({
    category: rule.name,
    limit: (rule.percentage / 100) * budgetConfig.monthlyIncome,
    spent: budgetMap.get(rule.id) || 0,
    planned: plannedBudgetMap.get(rule.id) || 0
  }));

  // Daily and Weekly data
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = todayStart - (7 * 24 * 60 * 60 * 1000);

  const recentItems = items.filter(i => {
      const d = new Date(i.created_at).getTime();
      return d >= sevenDaysAgo;
  });

  const todayItems = recentItems.filter(i => new Date(i.created_at).getTime() >= todayStart);

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

  // Skill Progress
  const skillProgress = skills.map(s => {
      // Calculate weekly progress
      const startOfWeek = new Date();
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setHours(0, 0, 0, 0);
      startOfWeek.setDate(diff);

      const weeklyMinutes = items
          .filter(i => i.type === ItemType.SKILL_LOG && i.meta.skillId === s.id)
          .filter(i => {
              const d = new Date(i.meta.date || i.created_at);
              return d >= startOfWeek;
          })
          .reduce((sum, i) => sum + (i.meta.durationMinutes || 0), 0);

      return {
          name: s.name,
          current: weeklyMinutes,
          target: s.weeklyTargetMinutes || 0,
          percentage: s.weeklyTargetMinutes ? Math.round((weeklyMinutes / s.weeklyTargetMinutes) * 100) : 0
      };
  });

  // Saving Goals
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
    today: getSummaryStats(todayItems),
    past7Days: getSummaryStats(recentItems),
    currentMonth: {
      daysElapsed: currentDay,
      dailyAverageExpense: currentTotalExpense / currentDay,
      totalExpense: currentTotalExpense,
      projectedTotalExpense: currentTotalExpense + projectedExpense,
      expenseByTag: currentTags,
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
    1. "Daily Review": Focus on today's or recent daily averages (budget, focus, goals, shopping, journal).
    2. "Weekly Review": Focus on the past 7 days trend.
    3. "Month over Month Review": Compare the current month's data (up to today) with last month's data (up to the same day).
    4. "General Review": A holistic overview or advice covering budget, focus, goals, shopping, journal, etc.
    
    CRITICAL RULES:
    1. DO NOT write paragraphs. Keep the message extremely short, punchy, and to the point (max 2 short sentences per review).
    2. Use specific numbers and tags provided.
    3. Cover ALL aspects: Budget, Focus (Tasks), Goals (Skills/Savings), Shopping, and Journaling.
    4. The 'title' field MUST be exactly one of: "Daily Review", "Weekly Review", "Month over Month Review", "General Review".
    
    Data Summary (Apple-to-Apple comparison up to day ${currentDay} of the month):
    ${JSON.stringify(dataSummary, null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
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
    });

    const parsed = JSON.parse(response.text || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to generate AI insights:", error);
    return [];
  }
};
