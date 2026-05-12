import { useState, useRef, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
    BrainDumpItem,
    ItemType,
    BudgetConfig,
    Skill,
    Wallet,
    FinanceType,
    AppSettings,
    SyncStatus,
    DbSchema,
    ShoppingCategory,
    Priority,
    ChatMessage,
    ParserResultV2,
    ParserAction,
    ParserEntityType,
    ParsedItemMetaV2,
    CreateItemPayload,
    UpdateItemPayload,
    CompleteItemPayload,
    DeleteItemPayload,
    CreateSkillPayload,
    CreateWalletPayload,
    ThemePayload,
    TransferMoneyPayload,
    AddSavingFundsPayload,
    ParsingTask,
    CanonicalRule,
    ItemMeta,
    InvestmentAssetType,
    EnrichmentTask
} from '../types';
import { fetchDb, syncData, isUsingLocalStorage } from '../services/syncFacade';
import { SyncResult } from '../services/syncTypes';
import { getCachedSpreadsheetDb } from '../services/spreadsheetService';
import { syncItemsToGoogleCalendar } from '../services/googleCalendarService';
import { recoverMisclassifiedJournalNotes, upsertDailyJournalEntry } from '../utils/journalUtils';
import { mergeDbData } from '../utils/mergeUtils';
import { classifyText, DEFAULT_PROMPT } from '../services/geminiService';
import { parsePro } from '../services/geminiProService';
import { calculateNextDueDate, calculateFirstDueDate } from '../utils/selectors';
import { ACHIEVED_GOAL_FINANCE_TYPE, getAchievedGoalName, isLegacyCompletedGoalContent } from '../utils/financeTypeUtils';
import { canonicalizeParserResults, learnCanonicalRulesFromReview, sweepHistoricalCanonicalMeta, HistoricalCanonicalReview } from '../services/canonicalizerService';
import { ASYNC_ENRICHMENT_REVIEW_PREFIX, queueCanonicalEnrichmentTasks, runCanonicalEnrichmentTasks } from '../services/asyncEnrichmentService';
import { getSystemCanonicalRules } from '../utils/canonicalization/systemRules';
import { applyDeepWorkChildProgress, applyDeepWorkCompletionSemantics, normalizeDeepWorkTodoMeta } from '../utils/deepWorkTodoModel';
import { buildDeepWorkSuggestionMeta, createDeepWorkSubtaskItems } from '../services/deepWorkTransformer';
import { guardParserResultMultiplicity } from '../utils/parserResultGuards';
import { routeBatchParserInput } from '../services/batchParserCoordinator';
import { runFastThenDeepParserModelRouting } from '../services/parserModelRouting';
import { shouldShoppingDateEditCompletion } from '../utils/shoppingDateUtils';
import { applyInvestmentFundingToInvestment, resolveInvestmentFundingInput } from '../utils/investmentFunding';

const normalizeWhitespace = (input: string) => input.replace(/\s+/g, ' ').trim();

type ParsingUndoSnapshot = {
    items: BrainDumpItem[];
    skills: Skill[];
    wallets: Wallet[];
    monthlyThemes: Record<string, string>;
    canonicalRules: CanonicalRule[];
};

const sanitizeNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return undefined;
    const cleaned = value.replace(/[^\d.-]/g, '');
    if (!cleaned) return undefined;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
};

const safeArrayStrings = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const result = value
        .map(v => typeof v === 'string' ? normalizeWhitespace(v) : '')
        .filter(Boolean);
    return result.length > 0 ? result : undefined;
};

const safeArrayNumbers = (value: unknown): number[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const result = value
        .map(v => (typeof v === 'number' && Number.isFinite(v) ? v : undefined))
        .filter((v): v is number => v !== undefined);
    return result.length > 0 ? result : undefined;
};

const stripDeepWorkFieldsFromMeta = (meta: ItemMeta = {}): ItemMeta => {
    const {
        parentTodoId,
        childTodoIds,
        deepWorkParent,
        deepWorkPlanId,
        deepWorkStatus,
        deepWorkTriggerPattern,
        deepWorkTriggerEvidence,
        deepWorkConfidence,
        deepWorkNextAction,
        deepWorkNextActionDurationMinutes,
        deepWorkNextActionAcceptanceCheck,
        deepWorkFinalOutputFormat,
        deepWorkFinalOutput,
        deepWorkSessionEstimateMinutes,
        deepWorkSessionEstimateConfidence,
        deepWorkSessionEstimateReason,
        deepWorkBlockerCheck,
        deepWorkBlockerStatus,
        deepWorkMissingInputs,
        deepWorkCompletionMode,
        deepWorkStepIndex,
        deepWorkStepCount,
        deepWorkGeneratedAt,
        deepWorkAcceptedAt,
        deepWorkDismissedAt,
        deepWorkReason,
        subtasks,
        ...rest
    } = meta;
    return rest;
};

const refreshDeepWorkSuggestionForTodo = (
    itemType: ItemType,
    status: BrainDumpItem['status'],
    content: string,
    meta: ItemMeta = {}
): ItemMeta => {
    if (itemType !== ItemType.TODO || status !== 'pending') return normalizeDeepWorkTodoMeta(meta);
    if (meta.parentTodoId || (meta.childTodoIds?.length || 0) > 0) return normalizeDeepWorkTodoMeta(meta);
    if (meta.deepWorkStatus === 'active' || meta.deepWorkStatus === 'accepted' || meta.deepWorkStatus === 'done' || meta.deepWorkStatus === 'dismissed') {
        return normalizeDeepWorkTodoMeta(meta);
    }

    const baseMeta = meta.deepWorkStatus === 'suggested' ? stripDeepWorkFieldsFromMeta(meta) : meta;
    const suggestedMeta = buildDeepWorkSuggestionMeta(content, baseMeta);
    return normalizeDeepWorkTodoMeta(suggestedMeta.deepWorkParent ? suggestedMeta : baseMeta);
};

const stripUndefined = <T extends Record<string, any>>(obj: T): T =>
    Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined)) as T;

const CANONICAL_BACKFILL_REVIEW_PREFIX = 'canonical-backfill-';

const lower = (s?: string) => (s || '').toLowerCase().trim();

const isValidFinanceType = (value: unknown): value is FinanceType =>
    typeof value === 'string' && ['expense', 'income', 'transfer', 'saving', 'achieved_goal'].includes(value);

const isValidPriority = (value: unknown): value is Priority =>
    typeof value === 'string' && ['low', 'normal', 'high'].includes(value);

const isValidShoppingCategory = (value: unknown): value is ShoppingCategory =>
    typeof value === 'string' && ['urgent', 'not_urgent', 'routine', 'saving', 'investment'].includes(value);

const isValidInvestmentAssetType = (value: unknown): value is InvestmentAssetType =>
    typeof value === 'string' && ['gold', 'stock', 'mutual_fund', 'crypto', 'bond', 'deposit', 'other'].includes(value);

const mapEntityTypeToItemType = (entityType: ParserEntityType, fallback: ItemType = ItemType.NOTE): ItemType => {
    switch (entityType) {
        case 'todo': return ItemType.TODO;
        case 'shopping': return ItemType.SHOPPING;
        case 'note': return ItemType.NOTE;
        case 'event': return ItemType.EVENT;
        case 'finance': return ItemType.FINANCE;
        case 'journal': return ItemType.JOURNAL;
        case 'skill_log': return ItemType.SKILL_LOG;
        case 'saving_goal': return ItemType.SHOPPING;
        default: return fallback;
    }
};

const migrateAchievedGoalItems = (items: BrainDumpItem[]) => {
    const updatedItems = items.map(item => ({
        ...item,
        meta: { ...item.meta }
    }));

    const doneSavingGoals = updatedItems.filter(item =>
        item.type === ItemType.SHOPPING &&
        item.meta.shoppingCategory === 'saving' &&
        item.status === 'done'
    );

    const totalSavedByGoalId = new Map<string, number>();
    updatedItems.forEach(item => {
        if (item.type === ItemType.FINANCE && item.status === 'done' && item.meta.financeType === 'saving' && item.meta.savingGoalId) {
            totalSavedByGoalId.set(item.meta.savingGoalId, (totalSavedByGoalId.get(item.meta.savingGoalId) || 0) + (item.meta.amount || 0));
        }
    });

    const achievedGoalItemIdsToKeep = new Set<string>();

    doneSavingGoals.forEach(goal => {
        const matchingFinanceItems = updatedItems.filter(item =>
            item.type === ItemType.FINANCE && (
                item.meta.savingGoalId === goal.id ||
                (isLegacyCompletedGoalContent(item.content) && getAchievedGoalName(item.content).toLowerCase() === goal.content.trim().toLowerCase())
            )
        );

        const existingAchieved = matchingFinanceItems.find(item => item.meta.financeType === ACHIEVED_GOAL_FINANCE_TYPE)
            || matchingFinanceItems.find(item => isLegacyCompletedGoalContent(item.content));

        const amount = totalSavedByGoalId.get(goal.id) || goal.meta.amount || 0;
        const completedAt = goal.completed_at || goal.meta.date || goal.created_at;
        const paymentMethod = goal.meta.dedicatedWalletId || existingAchieved?.meta.paymentMethod || goal.meta.paymentMethod;

        if (existingAchieved) {
            existingAchieved.content = `Completed Goal: ${goal.content}`;
            existingAchieved.status = 'done';
            existingAchieved.completed_at = existingAchieved.completed_at || completedAt;
            existingAchieved.meta.financeType = ACHIEVED_GOAL_FINANCE_TYPE;
            existingAchieved.meta.amount = existingAchieved.meta.amount || amount;
            existingAchieved.meta.paymentMethod = paymentMethod;
            existingAchieved.meta.savingGoalId = goal.id;
            existingAchieved.meta.date = existingAchieved.meta.date || completedAt;
            achievedGoalItemIdsToKeep.add(existingAchieved.id);
        } else {
            updatedItems.push({
                id: uuidv4(),
                type: ItemType.FINANCE,
                content: `Completed Goal: ${goal.content}`,
                status: 'done',
                created_at: completedAt,
                completed_at: completedAt,
                meta: {
                    tags: ['achieved-goal'],
                    amount,
                    paymentMethod,
                    financeType: ACHIEVED_GOAL_FINANCE_TYPE,
                    savingGoalId: goal.id,
                    date: completedAt
                }
            });
            achievedGoalItemIdsToKeep.add(updatedItems[updatedItems.length - 1].id);
        }
    });

    return updatedItems.filter(item => {
        if (item.type !== ItemType.FINANCE) return true;
        if (!isLegacyCompletedGoalContent(item.content)) return true;
        return achievedGoalItemIdsToKeep.has(item.id) || item.meta.financeType === ACHIEVED_GOAL_FINANCE_TYPE;
    });
};

const ensureInvestmentWalletsForItems = (items: BrainDumpItem[], wallets: Wallet[] = []) => {
    let changed = false;
    const nextWallets = [...wallets];
    const nextItems = items.map(item => ({ ...item, meta: { ...item.meta } }));

    nextItems.forEach(item => {
        if (item.type !== ItemType.SHOPPING || item.meta.shoppingCategory !== 'investment') return;
        if (item.meta.dedicatedWalletId && nextWallets.some(wallet => wallet.id === item.meta.dedicatedWalletId)) return;

        const platformName = item.meta.investmentPlatform?.trim();
        if (!platformName) return;

        let wallet = nextWallets.find(w => w.name.trim().toLowerCase() === platformName.toLowerCase());
        if (!wallet) {
            wallet = {
                id: uuidv4(),
                name: platformName,
                type: 'investment',
                initialBalance: 0,
                color: 'bg-emerald-500'
            };
            nextWallets.unshift(wallet);
            changed = true;
        }

        if (item.meta.dedicatedWalletId !== wallet.id) {
            item.meta.dedicatedWalletId = wallet.id;
            changed = true;
        }
    });

    return { items: nextItems, wallets: nextWallets, changed };
};

const convertLegacyResultsToNative = (legacyResults: Partial<BrainDumpItem>[], originalText: string): ParserResultV2[] => {
    return legacyResults.map((partial) => {
        const meta = partial.meta || {};
        const type = partial.type || ItemType.NOTE;

        return {
            action: 'create_item',
            entityType:
                type === ItemType.TODO ? 'todo' :
                type === ItemType.SHOPPING ? 'shopping' :
                type === ItemType.NOTE ? 'note' :
                type === ItemType.EVENT ? 'event' :
                type === ItemType.FINANCE ? 'finance' :
                type === ItemType.JOURNAL ? 'journal' :
                type === ItemType.SKILL_LOG ? 'skill_log' :
                'unknown',
            content: partial.content || originalText,
            confidence: meta.parsingError ? 'low' : 'medium',
            needsReview: !!meta.parsingError,
            reviewReason: meta.parsingError,
            payload: {
                itemType: type,
                content: partial.content || originalText,
                meta: {
                    title: meta.title,
                    date: meta.date,
                    dateTime: meta.dateTime,
                    when: meta.when,
                    tags: meta.tags,
                    quantity: meta.quantity,
                    priority: meta.priority,
                    shoppingCategory: meta.shoppingCategory,
                    amount: meta.amount,
                    currency: meta.currency,
                    financeType: meta.financeType,
                    paymentMethod: meta.paymentMethod,
                    toWallet: meta.toWallet,
                    budgetCategory: meta.budgetCategory,
                    commodity: meta.commodity,
                    subcommodity: meta.subcommodity,
                    merchant: meta.merchant,
                    durationMinutes: meta.durationMinutes,
                    skillName: meta.skillName,
                    skillId: meta.skillId,
                    progress: meta.progress,
                    progressNotes: meta.progressNotes,
                    parentTodoId: meta.parentTodoId,
                    childTodoIds: meta.childTodoIds,
                    deepWorkParent: meta.deepWorkParent,
                    deepWorkPlanId: meta.deepWorkPlanId,
                    deepWorkStatus: meta.deepWorkStatus,
                    deepWorkTriggerPattern: meta.deepWorkTriggerPattern,
                    deepWorkTriggerEvidence: meta.deepWorkTriggerEvidence,
                    deepWorkConfidence: meta.deepWorkConfidence,
                    deepWorkNextAction: meta.deepWorkNextAction,
                    deepWorkNextActionDurationMinutes: meta.deepWorkNextActionDurationMinutes,
                    deepWorkNextActionAcceptanceCheck: meta.deepWorkNextActionAcceptanceCheck,
                    deepWorkFinalOutputFormat: meta.deepWorkFinalOutputFormat,
                    deepWorkFinalOutput: meta.deepWorkFinalOutput,
                    deepWorkSessionEstimateMinutes: meta.deepWorkSessionEstimateMinutes,
                    deepWorkSessionEstimateConfidence: meta.deepWorkSessionEstimateConfidence,
                    deepWorkSessionEstimateReason: meta.deepWorkSessionEstimateReason,
                    deepWorkBlockerCheck: meta.deepWorkBlockerCheck,
                    deepWorkBlockerStatus: meta.deepWorkBlockerStatus,
                    deepWorkMissingInputs: meta.deepWorkMissingInputs,
                    deepWorkCompletionMode: meta.deepWorkCompletionMode,
                    deepWorkStepIndex: meta.deepWorkStepIndex,
                    deepWorkStepCount: meta.deepWorkStepCount,
                    deepWorkGeneratedAt: meta.deepWorkGeneratedAt,
                    deepWorkAcceptedAt: meta.deepWorkAcceptedAt,
                    deepWorkDismissedAt: meta.deepWorkDismissedAt,
                    deepWorkReason: meta.deepWorkReason,
                    subtasks: meta.subtasks,
                    savingGoalId: meta.savingGoalId,
                    savedAmount: meta.savedAmount,
                    dedicatedWalletId: meta.dedicatedWalletId,
                    investmentAssetType: meta.investmentAssetType,
                    investmentSymbol: meta.investmentSymbol,
                    investmentUnits: meta.investmentUnits,
                    investmentAveragePrice: meta.investmentAveragePrice,
                    investmentCurrentPrice: meta.investmentCurrentPrice,
                    investmentPlatform: meta.investmentPlatform,
                    isRoutine: meta.isRoutine,
                    routineInterval: meta.routineInterval,
                    routineDaysOfWeek: meta.routineDaysOfWeek,
                    routineDaysOfMonth: meta.routineDaysOfMonth,
                    routineMonthsOfYear: meta.routineMonthsOfYear,
                    recurrenceDays: meta.recurrenceDays,
                    targetDay: meta.targetDay
                }
            } as CreateItemPayload
        };
    });
};

export const useBrainDumpData = () => {
    const [items, setItems] = useState<BrainDumpItem[]>([]);
    const [budgetConfig, setBudgetConfig] = useState<BudgetConfig>({
        monthlyIncome: 0,
        rules: [
            { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
            { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
            { id: 'savings', name: 'Savings', percentage: 20, color: 'bg-emerald-500' },
        ]
    });
    const [skills, setSkills] = useState<Skill[]>([]);
    const [wallets, setWallets] = useState<Wallet[]>([]);
    const [customPrompt, setCustomPrompt] = useState<string>(DEFAULT_PROMPT);
    const [monthlyThemes, setMonthlyThemes] = useState<Record<string, string>>({});
    const [appSettings, setAppSettings] = useState<AppSettings>({ defaultCollapsed: true, hideMoney: false, enableDraftReview: false });
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => {
        const local = localStorage.getItem('braindump_chat_history');
        return local ? JSON.parse(local) : [];
    });
    const [canonicalRules, setCanonicalRules] = useState<CanonicalRule[]>([]);

    useEffect(() => {
        localStorage.setItem('braindump_chat_history', JSON.stringify(chatHistory));
    }, [chatHistory]);

    const [loading, setLoading] = useState(true);
    const [pendingCount, setPendingCount] = useState(0);
    const [parsingTasks, setParsingTasks] = useState<ParsingTask[]>([]);
    const [enrichmentTasks, setEnrichmentTasks] = useState<EnrichmentTask[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<SyncStatus>('synced');
    const [fetchStatus, setFetchStatus] = useState<SyncStatus>('synced');
    const [pendingReviews, setPendingReviews] = useState<HistoricalCanonicalReview[]>([]);

    const parsingInFlightRef = useRef<Set<string>>(new Set());
    const pendingSaveAfterParsingRef = useRef<{
        newItems?: BrainDumpItem[];
        newConfig?: BudgetConfig;
        newPrompt?: string;
        newSkills?: Skill[];
        newWallets?: Wallet[];
        newThemes?: Record<string, string>;
        newAppSettings?: AppSettings;
        newCanonicalRules?: CanonicalRule[];
        forceOverwrite: boolean;
    } | null>(null);
    const pendingFetchAfterParsingRef = useRef(false);
    const parsingUndoSnapshotsRef = useRef<Record<string, ParsingUndoSnapshot>>({});
    const enrichmentTasksRef = useRef<EnrichmentTask[]>([]);

    const hasActiveParsing = () => parsingInFlightRef.current.size > 0;

    const itemsRef = useRef(items);
    itemsRef.current = items;

    enrichmentTasksRef.current = enrichmentTasks;

    const canonicalRulesRef = useRef(canonicalRules);
    canonicalRulesRef.current = canonicalRules;

    const budgetConfigRef = useRef(budgetConfig);
    budgetConfigRef.current = budgetConfig;
    const customPromptRef = useRef(customPrompt);
    customPromptRef.current = customPrompt;
    const skillsRef = useRef(skills);
    skillsRef.current = skills;
    const walletsRef = useRef(wallets);
    walletsRef.current = wallets;
    const monthlyThemesRef = useRef(monthlyThemes);
    monthlyThemesRef.current = monthlyThemes;
    const appSettingsRef = useRef(appSettings);
    appSettingsRef.current = appSettings;
    const chatHistoryRef = useRef(chatHistory);
    chatHistoryRef.current = chatHistory;

    const checkRoutineResets = (currentItems: BrainDumpItem[]) => {
        const now = new Date();

        const updatedItems = currentItems.map(item => {
            const isShoppingRoutine = item.type === ItemType.SHOPPING && item.meta.shoppingCategory === 'routine';
            const isTodoRoutine = item.type === ItemType.TODO && item.meta.isRoutine;

            if ((isShoppingRoutine || isTodoRoutine) && item.status === 'done' && item.completed_at) {
                const completedDate = new Date(item.completed_at);
                let nextDueTime = completedDate.getTime();

                if (isShoppingRoutine) {
                    if (item.meta.routineInterval) {
                        nextDueTime = calculateNextDueDate(
                            completedDate,
                            item.meta.routineInterval,
                            item.meta.routineDaysOfWeek,
                            item.meta.routineDaysOfMonth,
                            item.meta.routineMonthsOfYear
                        ).getTime();
                    } else {
                        const recurrenceDays = item.meta.recurrenceDays || 7;
                        nextDueTime = completedDate.getTime() + (recurrenceDays * 24 * 60 * 60 * 1000);
                    }
                } else if (isTodoRoutine) {
                    nextDueTime = calculateNextDueDate(
                        completedDate,
                        item.meta.routineInterval || 'daily',
                        item.meta.routineDaysOfWeek,
                        item.meta.routineDaysOfMonth,
                        item.meta.routineMonthsOfYear
                    ).getTime();
                }

                if (now.getTime() >= nextDueTime) {
                    return {
                        ...item,
                        status: 'pending' as const,
                        completed_at: undefined,
                        meta: {
                            ...item.meta,
                            date: new Date(nextDueTime).toISOString()
                        }
                    };
                }
            }

            return item;
        });

        return updatedItems;
    };

    const performSaveAndSync = useCallback(async (
        newItems?: BrainDumpItem[],
        newConfig?: BudgetConfig,
        newPrompt?: string,
        newSkills?: Skill[],
        newWallets?: Wallet[],
        newThemes?: Record<string, string>,
        newAppSettings?: AppSettings,
        newCanonicalRules?: CanonicalRule[],
        forceOverwrite = false
    ) => {
        const baseItems = itemsRef.current;
        const itemsToSave = newItems || itemsRef.current;
        setSaveStatus('saving');

        try {
            const configToSave = newConfig || budgetConfigRef.current;
            const promptToSave = newPrompt !== undefined ? newPrompt : customPromptRef.current;
            const skillsToSave = newSkills || skillsRef.current;
            const walletsToSave = newWallets || walletsRef.current;
            const themesToSave = newThemes || monthlyThemesRef.current;
            const settingsToSave = newAppSettings || appSettingsRef.current;
            const canonicalRulesToSave = newCanonicalRules || canonicalRulesRef.current;

            const result: SyncResult = await syncData(
                itemsToSave,
                configToSave,
                promptToSave,
                skillsToSave,
                walletsToSave,
                themesToSave,
                settingsToSave,
                undefined,
                canonicalRulesToSave,
                forceOverwrite
            );

            if (!result.success) {
                throw new Error(result.error || "Sync failed, preserving local state.");
            }

            if (result.mergedData) {
                const remoteSchema = result.mergedData;
                setItems(currentItems => {
                    const merged = mergeDbData(
                        { data: currentItems, skills: skillsRef.current, wallets: walletsRef.current, monthlyThemes: monthlyThemesRef.current } as DbSchema,
                        remoteSchema,
                        { data: baseItems } as DbSchema
                    );
                    return merged.data;
                });
                setSkills(currentSkills => {
                    const merged = mergeDbData({ data: itemsRef.current, skills: currentSkills } as DbSchema, remoteSchema);
                    return merged.skills || [];
                });
                setWallets(currentWallets => {
                    const merged = mergeDbData({ data: itemsRef.current, wallets: currentWallets } as DbSchema, remoteSchema);
                    return merged.wallets || [];
                });
                if (remoteSchema.monthlyThemes) setMonthlyThemes(prev => ({ ...remoteSchema.monthlyThemes, ...prev }));
                if (remoteSchema.canonicalRules) setCanonicalRules(remoteSchema.canonicalRules);
            }

            if (settingsToSave.googleCalendarSyncEnabled) {
                try {
                    await syncItemsToGoogleCalendar(itemsToSave, settingsToSave);
                } catch (calendarError) {
                    console.warn('Google Calendar sync failed after data save', calendarError);
                    setError(`Data tersimpan, tapi sync Google Calendar gagal: ${calendarError instanceof Error ? calendarError.message : 'Unknown error'}`);
                }
            }

            setSaveStatus('synced');
        } catch (e) {
            console.error("Sync error:", e);
            setSaveStatus('error');
            setError(`Gagal menyimpan data ke cloud: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
    }, []);

    const saveAndSync = useCallback(async (
        newItems?: BrainDumpItem[],
        newConfig?: BudgetConfig,
        newPrompt?: string,
        newSkills?: Skill[],
        newWallets?: Wallet[],
        newThemes?: Record<string, string>,
        newAppSettings?: AppSettings,
        newCanonicalRules?: CanonicalRule[],
        forceOverwrite = false
    ) => {
        if (hasActiveParsing()) {
            const previous = pendingSaveAfterParsingRef.current;
            pendingSaveAfterParsingRef.current = {
                newItems: newItems || previous?.newItems,
                newConfig: newConfig || previous?.newConfig,
                newPrompt: newPrompt !== undefined ? newPrompt : previous?.newPrompt,
                newSkills: newSkills || previous?.newSkills,
                newWallets: newWallets || previous?.newWallets,
                newThemes: newThemes || previous?.newThemes,
                newAppSettings: newAppSettings || previous?.newAppSettings,
                newCanonicalRules: newCanonicalRules || previous?.newCanonicalRules,
                forceOverwrite: (previous?.forceOverwrite || forceOverwrite)
            };
            setSaveStatus('saving');
            return;
        }

        return performSaveAndSync(
            newItems,
            newConfig,
            newPrompt,
            newSkills,
            newWallets,
            newThemes,
            newAppSettings,
            newCanonicalRules,
            forceOverwrite
        );
    }, [performSaveAndSync]);

    const replaceHistoricalCanonicalReviews = useCallback((reviews: HistoricalCanonicalReview[]) => {
        setPendingReviews(prev => [
            ...reviews,
            ...prev.filter(review => !review.id.startsWith(CANONICAL_BACKFILL_REVIEW_PREFIX))
        ]);
    }, []);

    const runCanonicalBackfill = useCallback(() => {
        const sweep = sweepHistoricalCanonicalMeta(itemsRef.current, {
            existingItems: itemsRef.current,
            wallets: walletsRef.current,
            budgetRules: budgetConfigRef.current?.rules || [],
            rules: [...getSystemCanonicalRules(walletsRef.current), ...canonicalRulesRef.current],
        });

        replaceHistoricalCanonicalReviews(sweep.reviews);

        if (sweep.changedItemIds.length > 0) {
            setItems(sweep.items);
            saveAndSync(sweep.items, undefined, undefined, undefined, undefined, undefined, undefined, canonicalRulesRef.current);
        }

        return sweep;
    }, [replaceHistoricalCanonicalReviews, saveAndSync]);

    const toggleCanonicalRuleDisabled = useCallback((ruleId: string) => {
        const timestamp = new Date().toISOString();
        const nextRules = canonicalRulesRef.current.map(rule => {
            if (rule.id !== ruleId || rule.source !== 'learned') return rule;
            const nextDisabled = !rule.disabled;
            return {
                ...rule,
                disabled: nextDisabled,
                autoApplyDisabled: nextDisabled ? true : rule.rejectionCount >= 2,
                disabledReason: nextDisabled ? 'manually disabled in Control Center' : undefined,
                updatedAt: timestamp,
            };
        });

        canonicalRulesRef.current = nextRules;
        setCanonicalRules(nextRules);
        saveAndSync(undefined, undefined, undefined, undefined, undefined, undefined, undefined, nextRules);
    }, [saveAndSync]);

    const isSyncingRef = useRef(false);

    const loadData = useCallback(async () => {
        if (hasActiveParsing()) {
            pendingFetchAfterParsingRef.current = true;
            setFetchStatus('syncing');
            return;
        }

        if (isSyncingRef.current && itemsRef.current.length > 0) return;

        isSyncingRef.current = true;
        try {
            if (itemsRef.current.length === 0) setLoading(true);
            setFetchStatus('syncing');
            setError(null);

            const applyData = (data: DbSchema) => {
                let walletsToApply = data.wallets || walletsRef.current;
                if (Array.isArray(data.data)) {
                    const normalizedData = data.data.map(item => {
                        const meta = normalizeDeepWorkTodoMeta({
                            tags: [],
                            ...item.meta,
                            shoppingCategory: (item.type === ItemType.SHOPPING && !item.meta?.shoppingCategory)
                                ? 'not_urgent'
                                : item.meta?.shoppingCategory
                        });

                        return {
                            ...item,
                            status: item.type === ItemType.FINANCE ? 'done' : item.status,
                            completed_at: item.type === ItemType.FINANCE
                                ? (item.completed_at || item.meta?.date || item.created_at)
                                : item.completed_at,
                            meta
                        };
                    });

                    const migratedData = migrateAchievedGoalItems(normalizedData);
                    const recoveredJournalData = recoverMisclassifiedJournalNotes(migratedData);

                    const investmentWalletMigration = ensureInvestmentWalletsForItems(recoveredJournalData, data.wallets || walletsRef.current);
                    const checkedData = checkRoutineResets(investmentWalletMigration.items);
                    const canonicalRulesForSweep = data.canonicalRules || canonicalRulesRef.current;
                    const walletsForSweep = investmentWalletMigration.wallets;
                    walletsToApply = walletsForSweep;
                    const budgetRulesForSweep = data.budgetConfig?.rules || budgetConfigRef.current?.rules || [];
                    const canonicalSweep = sweepHistoricalCanonicalMeta(checkedData, {
                        existingItems: checkedData,
                        wallets: walletsForSweep,
                        budgetRules: budgetRulesForSweep,
                        rules: [...getSystemCanonicalRules(walletsForSweep), ...canonicalRulesForSweep],
                    });

                    replaceHistoricalCanonicalReviews(canonicalSweep.reviews);
                    setItems(canonicalSweep.items);

                    if (investmentWalletMigration.changed || JSON.stringify(canonicalSweep.items) !== JSON.stringify(data.data)) {
                        saveAndSync(canonicalSweep.items, data.budgetConfig, data.customPrompt, data.skills, walletsForSweep, data.monthlyThemes, data.appSettings, data.canonicalRules);
                    }
                }

                if (data.budgetConfig) setBudgetConfig(data.budgetConfig);
                if (data.customPrompt) setCustomPrompt(data.customPrompt);
                if (data.skills) {
                    setSkills(data.skills);
                } else {
                    const defaults: Skill[] = [
                        { id: 'skill-1', name: 'General Learning', color: 'indigo-500', created_at: new Date().toISOString() }
                    ];
                    setSkills(defaults);
                    saveAndSync(data.data || [], data.budgetConfig, data.customPrompt, defaults, data.wallets, data.monthlyThemes, data.appSettings, data.canonicalRules);
                }

                if (walletsToApply) setWallets(walletsToApply);
                if (data.monthlyThemes) setMonthlyThemes(data.monthlyThemes);
                if (data.appSettings) setAppSettings(data.appSettings);
                if (data.chatHistory) setChatHistory(data.chatHistory);
                if (data.canonicalRules) setCanonicalRules(data.canonicalRules);
            };

            // Load local data first for instant display
            try {
                const cachedData = getCachedSpreadsheetDb();
                if (cachedData) {
                    applyData(cachedData);
                    setLoading(false); // Stop loading spinner if we have local data
                }
            } catch (e) {
                console.warn("Failed to load spreadsheet cache initially", e);
            }

            const { data } = await fetchDb();
            if (data) {
                applyData(data);
            }

            setFetchStatus(isUsingLocalStorage() ? 'local' : 'synced');
        } catch (e) {
            console.error("Load data failed:", e);
            setError(e instanceof Error ? e.message : 'Failed to load data');
            setFetchStatus('error');
        } finally {
            setLoading(false);
            isSyncingRef.current = false;
        }
    }, [replaceHistoricalCanonicalReviews, saveAndSync]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const flushDeferredSyncAfterParsing = useCallback(async () => {
        if (hasActiveParsing()) return;

        const deferredSave = pendingSaveAfterParsingRef.current;
        const shouldFetch = pendingFetchAfterParsingRef.current;

        pendingSaveAfterParsingRef.current = null;
        pendingFetchAfterParsingRef.current = false;

        if (deferredSave) {
            await performSaveAndSync(
                deferredSave.newItems || itemsRef.current,
                deferredSave.newConfig || budgetConfigRef.current,
                deferredSave.newPrompt !== undefined ? deferredSave.newPrompt : customPromptRef.current,
                deferredSave.newSkills || skillsRef.current,
                deferredSave.newWallets || walletsRef.current,
                deferredSave.newThemes || monthlyThemesRef.current,
                deferredSave.newAppSettings || appSettingsRef.current,
                deferredSave.newCanonicalRules || canonicalRulesRef.current,
                deferredSave.forceOverwrite
            );
        }

        if (shouldFetch) {
            await loadData();
        }
    }, [loadData, performSaveAndSync]);

    const buildMetaFromParsed = (meta?: ParsedItemMetaV2, action?: ParserAction, entityType?: ParserEntityType, confidence?: string, needsReview?: boolean, reviewReason?: string) => {
        const cleanMeta = stripUndefined({
            date: meta?.date,
            title: meta?.title,
            dateTime: meta?.dateTime,
            start: meta?.start,
            end: meta?.end,
            when: meta?.when,
            tags: meta?.tags || [],
            quantity: meta?.quantity,
            shoppingCategory: meta?.shoppingCategory,
            recurrenceDays: meta?.recurrenceDays,
            targetDay: meta?.targetDay,
            isRoutine: meta?.isRoutine,
            routineInterval: meta?.routineInterval,
            routineDaysOfWeek: meta?.routineDaysOfWeek,
            routineDaysOfMonth: meta?.routineDaysOfMonth,
            routineMonthsOfYear: meta?.routineMonthsOfYear,
            amount: meta?.amount,
            currency: meta?.currency,
            financeType: meta?.financeType,
            paymentMethod: meta?.paymentMethod,
            toWallet: meta?.toWallet,
            budgetCategory: meta?.budgetCategory,
            commodity: meta?.commodity,
            subcommodity: meta?.subcommodity,
            merchant: meta?.merchant,
            durationMinutes: meta?.durationMinutes,
            skillId: meta?.skillId,
            skillName: meta?.skillName,
            progress: meta?.progress,
            progressNotes: meta?.progressNotes,
            parentTodoId: meta?.parentTodoId,
            childTodoIds: meta?.childTodoIds,
            deepWorkParent: meta?.deepWorkParent,
            deepWorkPlanId: meta?.deepWorkPlanId,
            deepWorkStatus: meta?.deepWorkStatus,
            deepWorkTriggerPattern: meta?.deepWorkTriggerPattern,
            deepWorkTriggerEvidence: meta?.deepWorkTriggerEvidence,
            deepWorkConfidence: meta?.deepWorkConfidence,
            deepWorkNextAction: meta?.deepWorkNextAction,
            deepWorkNextActionDurationMinutes: meta?.deepWorkNextActionDurationMinutes,
            deepWorkNextActionAcceptanceCheck: meta?.deepWorkNextActionAcceptanceCheck,
            deepWorkFinalOutputFormat: meta?.deepWorkFinalOutputFormat,
            deepWorkFinalOutput: meta?.deepWorkFinalOutput,
            deepWorkSessionEstimateMinutes: meta?.deepWorkSessionEstimateMinutes,
            deepWorkSessionEstimateConfidence: meta?.deepWorkSessionEstimateConfidence,
            deepWorkSessionEstimateReason: meta?.deepWorkSessionEstimateReason,
            deepWorkBlockerCheck: meta?.deepWorkBlockerCheck,
            deepWorkBlockerStatus: meta?.deepWorkBlockerStatus,
            deepWorkMissingInputs: meta?.deepWorkMissingInputs,
            deepWorkCompletionMode: meta?.deepWorkCompletionMode,
            deepWorkStepIndex: meta?.deepWorkStepIndex,
            deepWorkStepCount: meta?.deepWorkStepCount,
            deepWorkGeneratedAt: meta?.deepWorkGeneratedAt,
            deepWorkAcceptedAt: meta?.deepWorkAcceptedAt,
            deepWorkDismissedAt: meta?.deepWorkDismissedAt,
            deepWorkReason: meta?.deepWorkReason,
            subtasks: meta?.subtasks,
            savedAmount: meta?.savedAmount,
            savingGoalId: meta?.savingGoalId,
            dedicatedWalletId: meta?.dedicatedWalletId,
            investmentAssetType: isValidInvestmentAssetType(meta?.investmentAssetType) ? meta?.investmentAssetType : undefined,
            investmentSymbol: meta?.investmentSymbol,
            investmentUnits: meta?.investmentUnits,
            investmentAveragePrice: meta?.investmentAveragePrice,
            investmentCurrentPrice: meta?.investmentCurrentPrice,
            investmentPlatform: meta?.investmentPlatform,
            canonical: meta?.canonical,
            priority: meta?.priority,
            hideFromCalendar: meta?.hideFromCalendar,
            parserAction: action,
            parserEntityType: entityType,
            parserConfidence: confidence as any,
            parserNeedsReview: needsReview,
            parserReviewReason: reviewReason,
            parsingError: reviewReason
        });
        return normalizeDeepWorkTodoMeta(cleanMeta);
    };

    const buildItemFromCreatePayload = (
        result: ParserResultV2,
        payload: CreateItemPayload,
        sourceText: string
    ): BrainDumpItem => {
        const type = mapEntityTypeToItemType(result.entityType, payload.itemType as ItemType);
        const isRecord = type === ItemType.FINANCE || type === ItemType.JOURNAL || type === ItemType.SKILL_LOG;

        const meta = buildMetaFromParsed(
            payload.meta,
            result.action,
            result.entityType,
            result.confidence,
            result.needsReview,
            result.reviewReason
        );

        let status: 'pending' | 'done' = isRecord ? 'done' : 'pending';
        let completedAt: string | undefined = isRecord ? new Date().toISOString() : undefined;

        if (payload.status === 'done') {
            status = 'done';
            completedAt = new Date().toISOString();
        }

        if (type === ItemType.TODO || type === ItemType.EVENT) {
            if (!meta.priority) meta.priority = 'normal';
        }

        if (type === ItemType.SHOPPING && !meta.shoppingCategory) {
            meta.shoppingCategory = meta.isRoutine ? 'routine' : 'not_urgent';
        }

        if (type === ItemType.JOURNAL && !meta.date) {
            meta.date = new Date().toISOString();
        }

        return {
            id: uuidv4(),
            type,
            content: payload.content || result.content || sourceText,
            status,
            created_at: new Date().toISOString(),
            completed_at: completedAt,
            meta,
            isOptimistic: false
        };
    };

    const buildItemsFromCreatePayload = (
        result: ParserResultV2,
        payload: CreateItemPayload,
        sourceText: string
    ): BrainDumpItem[] => {
        const parent = buildItemFromCreatePayload(result, payload, sourceText);
        if (parent.type !== ItemType.TODO || parent.status === 'done') return [parent];

        const suggestedMeta = normalizeDeepWorkTodoMeta(buildDeepWorkSuggestionMeta(parent.content, parent.meta));
        if (!suggestedMeta.deepWorkParent) return [parent];

        return [{
            ...parent,
            meta: normalizeDeepWorkTodoMeta({
                ...suggestedMeta,
                deepWorkPlanId: suggestedMeta.deepWorkPlanId || parent.id,
                progress: suggestedMeta.progress ?? 0,
            })
        }];
    };

    const buildTransferItem = (result: ParserResultV2, payload: TransferMoneyPayload): BrainDumpItem => {
        return {
            id: uuidv4(),
            type: ItemType.FINANCE,
            content: payload.note || result.content || `Transfer ${payload.fromWallet || ''} ke ${payload.toWallet || ''}`.trim(),
            status: 'done',
            created_at: new Date().toISOString(),
            completed_at: payload.date || new Date().toISOString(),
            meta: buildMetaFromParsed({
                date: payload.date || new Date().toISOString(),
                amount: sanitizeNumber(payload.amount),
                financeType: 'transfer',
                paymentMethod: payload.fromWallet,
                toWallet: payload.toWallet,
                tags: ['transfer']
            }, result.action, result.entityType, result.confidence, result.needsReview, result.reviewReason)
        };
    };

    const buildSavingFundsItem = (result: ParserResultV2, payload: AddSavingFundsPayload): BrainDumpItem => {
        return {
            id: uuidv4(),
            type: ItemType.FINANCE,
            content: payload.note || result.content || `Saved for: ${payload.savingGoalName || 'Saving Goal'}`,
            status: 'done',
            created_at: new Date().toISOString(),
            completed_at: payload.date || new Date().toISOString(),
            meta: buildMetaFromParsed({
                date: payload.date || new Date().toISOString(),
                amount: sanitizeNumber(payload.amount),
                financeType: 'saving',
                paymentMethod: payload.fromWallet,
                toWallet: payload.toWallet,
                budgetCategory: payload.budgetCategory || 'savings',
                savingGoalId: payload.savingGoalId,
                tags: ['saving']
            }, result.action, result.entityType, result.confidence, result.needsReview, result.reviewReason)
        };
    };

    const executeParserResults = (
        parsedResults: ParserResultV2[],
        sourceText: string,
        tempId: string,
        canonicalRulesOverride?: CanonicalRule[]
    ) => {
        const markParserCreatedItem = (item: BrainDumpItem): BrainDumpItem => ({
            ...item,
            meta: {
                ...item.meta,
                parserTaskId: tempId
            }
        });

        setItems((prev) => {
            const prevWithoutOptimistic = prev.filter(i => i.id !== tempId);
            parsingUndoSnapshotsRef.current[tempId] = {
                items: prevWithoutOptimistic,
                skills: skillsRef.current,
                wallets: walletsRef.current,
                monthlyThemes: monthlyThemesRef.current,
                canonicalRules: canonicalRulesRef.current,
            };

            let updated = [...prevWithoutOptimistic];
            const itemsToAdd: BrainDumpItem[] = [];

            let newSkills = [...skillsRef.current];
            let newWallets = [...walletsRef.current];
            let newThemes = { ...monthlyThemesRef.current };

            let hasSkillChange = false;
            let hasWalletChange = false;
            let hasThemeChange = false;

            for (const result of parsedResults) {
                switch (result.action) {
                    case 'create_item': {
                        const payload = result.payload as CreateItemPayload | undefined;
                        if (!payload) break;
                        const newItems = buildItemsFromCreatePayload(result, payload, sourceText);
                        newItems.forEach(newItem => {
                            const createdItem = markParserCreatedItem(newItem);
                            if (createdItem.type === ItemType.JOURNAL) {
                                updated = upsertDailyJournalEntry(updated, createdItem);
                            } else {
                                itemsToAdd.push(createdItem);
                            }
                        });
                        break;
                    }

                    case 'update_item': {
                        const payload = result.payload as UpdateItemPayload | undefined;
                        const targetId = payload?.match?.itemId || result.entityRefs?.itemId;
                        if (!targetId) {
                            itemsToAdd.push(markParserCreatedItem({
                                id: uuidv4(),
                                type: ItemType.NOTE,
                                content: sourceText,
                                status: 'pending',
                                created_at: new Date().toISOString(),
                                meta: {
                                    tags: ['needs-review'],
                                    parsingError: result.reviewReason || 'Could not resolve target item for update',
                                    parserAction: result.action,
                                    parserEntityType: result.entityType,
                                    parserConfidence: result.confidence,
                                    parserNeedsReview: true
                                }
                            }));
                            break;
                        }

                        updated = updated.map(i => {
                            if (i.id !== targetId) return i;

                            const changes = payload?.changes || {};
                            const cleanMeta = stripUndefined({
                                date: changes.date,
                                title: changes.title,
                                tags: changes.tags,
                                amount: sanitizeNumber(changes.amount),
                                financeType: changes.financeType,
                                paymentMethod: changes.paymentMethod,
                                toWallet: changes.toWallet,
                                budgetCategory: changes.budgetCategory,
                                commodity: changes.commodity,
                                subcommodity: changes.subcommodity,
                                merchant: changes.merchant,
                                canonical: changes.canonical ? { ...(i.meta.canonical || {}), ...changes.canonical } : undefined,
                                quantity: changes.quantity,
                                shoppingCategory: changes.shoppingCategory,
                                priority: changes.priority,
                                durationMinutes: sanitizeNumber(changes.durationMinutes),
                                skillName: changes.skillName,
                                progress: sanitizeNumber(changes.progress),
                                progressNotes: changes.progressNotes,
                                parentTodoId: changes.parentTodoId,
                                childTodoIds: changes.childTodoIds,
                                deepWorkParent: changes.deepWorkParent,
                                deepWorkPlanId: changes.deepWorkPlanId,
                                deepWorkStatus: changes.deepWorkStatus,
                                deepWorkNextAction: changes.deepWorkNextAction,
                                deepWorkFinalOutput: changes.deepWorkFinalOutput,
                                deepWorkSessionEstimateMinutes: sanitizeNumber(changes.deepWorkSessionEstimateMinutes),
                                deepWorkBlockerCheck: changes.deepWorkBlockerCheck,
                                deepWorkBlockerStatus: changes.deepWorkBlockerStatus,
                                deepWorkCompletionMode: changes.deepWorkCompletionMode,
                                deepWorkStepIndex: sanitizeNumber(changes.deepWorkStepIndex),
                                deepWorkStepCount: sanitizeNumber(changes.deepWorkStepCount),
                                deepWorkGeneratedAt: changes.deepWorkGeneratedAt,
                                deepWorkAcceptedAt: changes.deepWorkAcceptedAt,
                                deepWorkDismissedAt: changes.deepWorkDismissedAt,
                                deepWorkReason: changes.deepWorkReason,
                                subtasks: changes.subtasks,
                                isRoutine: changes.isRoutine,
                                routineInterval: changes.routineInterval,
                                routineDaysOfWeek: changes.routineDaysOfWeek,
                                routineDaysOfMonth: changes.routineDaysOfMonth,
                                routineMonthsOfYear: changes.routineMonthsOfYear,
                                recurrenceDays: sanitizeNumber(changes.recurrenceDays),
                                targetDay: changes.targetDay,
                                status: undefined
                            });

                            const newContent = changes.content && changes.content !== i.content ? changes.content : i.content;

                            let newStatus = i.status;
                            let completedAt = i.completed_at;

                            if (changes.status === 'done' && i.status !== 'done') {
                                newStatus = 'done';
                                completedAt = new Date().toISOString();
                            } else if (changes.status === 'pending' && i.status !== 'pending') {
                                newStatus = 'pending';
                                completedAt = undefined;
                            } else if (typeof cleanMeta.progress === 'number') {
                                if (cleanMeta.progress === 100 && i.status === 'pending') {
                                    newStatus = 'done';
                                    completedAt = new Date().toISOString();
                                } else if (cleanMeta.progress < 100 && i.status === 'done') {
                                    newStatus = 'pending';
                                    completedAt = undefined;
                                }
                            }

                            const mergedMeta = refreshDeepWorkSuggestionForTodo(i.type, newStatus, newContent, {
                                ...i.meta,
                                ...cleanMeta,
                                parserAction: result.action,
                                parserEntityType: result.entityType,
                                parserConfidence: result.confidence,
                                parserNeedsReview: result.needsReview,
                                parserReviewReason: result.reviewReason,
                                parserTaskId: tempId,
                                parsingError: result.reviewReason
                            });

                            return {
                                ...i,
                                content: newContent,
                                status: newStatus,
                                completed_at: completedAt,
                                meta: mergedMeta
                            };
                        });
                        break;
                    }

                    case 'complete_item': {
                        const payload = result.payload as CompleteItemPayload | undefined;
                        const targetId = payload?.match?.itemId || result.entityRefs?.itemId;
                        if (!targetId) {
                            itemsToAdd.push(markParserCreatedItem({
                                id: uuidv4(),
                                type: ItemType.NOTE,
                                content: sourceText,
                                status: 'pending',
                                created_at: new Date().toISOString(),
                                meta: {
                                    tags: ['needs-review'],
                                    parsingError: result.reviewReason || 'Could not resolve target item for completion',
                                    parserAction: result.action,
                                    parserEntityType: result.entityType,
                                    parserConfidence: result.confidence,
                                    parserNeedsReview: true
                                }
                            }));
                            break;
                        }

                        updated = updated.map(i => {
                            if (i.id !== targetId) return i;
                            return {
                                ...i,
                                status: 'done',
                                completed_at: payload?.completedAt || new Date().toISOString(),
                                meta: {
                                    ...i.meta,
                                    progress: 100,
                                    parserAction: result.action,
                                    parserEntityType: result.entityType,
                                    parserConfidence: result.confidence,
                                    parserNeedsReview: result.needsReview,
                                    parserReviewReason: result.reviewReason,
                                    parsingError: result.reviewReason
                                }
                            };
                        });
                        break;
                    }

                    case 'delete_item': {
                        const payload = result.payload as DeleteItemPayload | undefined;
                        const targetId = payload?.match?.itemId || result.entityRefs?.itemId;
                        if (!targetId) {
                            itemsToAdd.push(markParserCreatedItem({
                                id: uuidv4(),
                                type: ItemType.NOTE,
                                content: sourceText,
                                status: 'pending',
                                created_at: new Date().toISOString(),
                                meta: {
                                    tags: ['needs-review'],
                                    parsingError: result.reviewReason || 'Could not resolve target item for deletion',
                                    parserAction: result.action,
                                    parserEntityType: result.entityType,
                                    parserConfidence: result.confidence,
                                    parserNeedsReview: true
                                }
                            }));
                            break;
                        }

                        updated = updated.filter(i => i.id !== targetId);
                        break;
                    }

                    case 'create_skill': {
                        const payload = result.payload as CreateSkillPayload | undefined;
                        const skillName = payload?.name || result.content;
                        if (!skillName) break;

                        newSkills.push({
                            id: uuidv4(),
                            name: skillName,
                            color: 'bg-blue-500',
                            created_at: new Date().toISOString(),
                            weeklyTargetMinutes:
                                sanitizeNumber(payload?.targetMinutes) ??
                                ((sanitizeNumber(payload?.targetHours) || 0) > 0 ? sanitizeNumber(payload?.targetHours)! * 60 : undefined)
                        });
                        hasSkillChange = true;
                        break;
                    }

                    case 'create_wallet': {
                        const payload = result.payload as CreateWalletPayload | undefined;
                        const walletName = payload?.name || result.content;
                        if (!walletName) break;

                        const walletType = payload?.walletType && ['cash', 'bank', 'ewallet', 'cc', 'investment'].includes(payload.walletType)
                            ? payload.walletType as Wallet['type']
                            : 'cash';

                        newWallets.push({
                            id: uuidv4(),
                            name: walletName,
                            type: walletType,
                            initialBalance: sanitizeNumber(payload?.initialBalance) || 0,
                            color: 'bg-emerald-500'
                        });
                        hasWalletChange = true;
                        break;
                    }

                    case 'create_theme':
                    case 'update_theme': {
                        const payload = result.payload as ThemePayload | undefined;
                        const monthKey = payload?.monthKey || new Date().toISOString().slice(0, 7);
                        const themeContent = payload?.content || result.content;
                        if (!themeContent) break;
                        newThemes[monthKey] = themeContent;
                        hasThemeChange = true;
                        break;
                    }

                    case 'transfer_money': {
                        const payload = result.payload as TransferMoneyPayload | undefined;
                        if (!payload) break;
                        const newItem = markParserCreatedItem(buildTransferItem(result, payload));
                        itemsToAdd.push(newItem);
                        break;
                    }

                    case 'add_saving_funds': {
                        const payload = result.payload as AddSavingFundsPayload | undefined;
                        if (!payload) break;
                        const newItem = markParserCreatedItem(buildSavingFundsItem(result, payload));
                        itemsToAdd.push(newItem);
                        break;
                    }

                    case 'query_only': {
                        break;
                    }

                    case 'unknown':
                    default: {
                        itemsToAdd.push(markParserCreatedItem({
                            id: uuidv4(),
                            type: ItemType.NOTE,
                            content: result.content || sourceText,
                            status: 'pending',
                            created_at: new Date().toISOString(),
                            meta: {
                                tags: ['needs-review'],
                                parserAction: result.action,
                                parserEntityType: result.entityType,
                                parserConfidence: result.confidence,
                                parserNeedsReview: true,
                                parserReviewReason: result.reviewReason || 'Parser returned unknown action',
                                parsingError: result.reviewReason || 'Parser returned unknown action'
                            }
                        }));
                        break;
                    }
                }
            }

            updated = [...itemsToAdd, ...updated];

            if (hasSkillChange) setSkills(newSkills);
            if (hasWalletChange) setWallets(newWallets);
            if (hasThemeChange) setMonthlyThemes(newThemes);

            itemsRef.current = updated;

            saveAndSync(
                updated,
                undefined,
                undefined,
                hasSkillChange ? newSkills : undefined,
                hasWalletChange ? newWallets : undefined,
                hasThemeChange ? newThemes : undefined,
                undefined,
                canonicalRulesOverride
            );

            return updated;
        });
    };

    const replaceAsyncEnrichmentReviews = useCallback((reviews: HistoricalCanonicalReview[]) => {
        if (reviews.length === 0) return;
        const reviewIds = new Set(reviews.map(review => review.id));
        setPendingReviews(prev => [
            ...reviews,
            ...prev.filter(review => !reviewIds.has(review.id) && !review.id.startsWith(ASYNC_ENRICHMENT_REVIEW_PREFIX))
        ]);
    }, []);

    const processEnrichmentTasks = useCallback(async (tasks: EnrichmentTask[]) => {
        if (tasks.length === 0) return;

        setEnrichmentTasks(prev => prev.map(task =>
            tasks.some(nextTask => nextTask.id === task.id)
                ? { ...task, status: 'running', attempts: task.attempts + 1 }
                : task
        ));

        try {
            const result = runCanonicalEnrichmentTasks({
                items: itemsRef.current,
                tasks,
                ctx: {
                    existingItems: itemsRef.current,
                    wallets: walletsRef.current,
                    budgetRules: budgetConfigRef.current?.rules || [],
                    rules: [...getSystemCanonicalRules(walletsRef.current), ...canonicalRulesRef.current],
                },
            });

            if (result.reviews.length > 0) replaceAsyncEnrichmentReviews(result.reviews);

            if (result.changedItemIds.length > 0) {
                itemsRef.current = result.items;
                setItems(result.items);
                saveAndSync(result.items, undefined, undefined, undefined, undefined, undefined, undefined, canonicalRulesRef.current);
            }

            setEnrichmentTasks(prev => {
                const resultsById = new Map(result.taskResults.map(task => [task.id, task]));
                return prev.map(task => resultsById.get(task.id) || task);
            });
        } catch (err: any) {
            setEnrichmentTasks(prev => prev.map(task =>
                tasks.some(nextTask => nextTask.id === task.id)
                    ? { ...task, status: 'failed', error: err?.message || 'Async enrichment failed', completedAt: Date.now() }
                    : task
            ));
        }
    }, [replaceAsyncEnrichmentReviews, saveAndSync]);

    const enqueueEnrichmentForParserTask = useCallback((parserTaskId: string, sourceText: string) => {
        const targetItemIds = itemsRef.current
            .filter(item => item.meta?.parserTaskId === parserTaskId)
            .map(item => item.id);

        const queuedTasks = queueCanonicalEnrichmentTasks({
            items: itemsRef.current,
            itemIds: targetItemIds,
            parserTaskId,
            sourceText,
        }).filter(task => !enrichmentTasksRef.current.some(existing => existing.id === task.id));

        if (queuedTasks.length === 0) return;

        setEnrichmentTasks(prev => [...queuedTasks, ...prev]);
        enrichmentTasksRef.current = [...queuedTasks, ...enrichmentTasksRef.current];
        Promise.resolve().then(() => processEnrichmentTasks(queuedTasks));
    }, [processEnrichmentTasks]);

    const processItemInBackground = async (text: string, tempId: string) => {
        parsingInFlightRef.current.add(tempId);
        setParsingTasks(prev => {
            const nextTask: ParsingTask = { id: tempId, text, status: 'pending', createdAt: Date.now() };
            return prev.some(t => t.id === tempId)
                ? prev.map(t => t.id === tempId ? { ...t, text, status: 'pending', stage: undefined, error: undefined, results: undefined, routerDecision: undefined, batch: undefined, duplicateGuardRemovedCount: undefined, duplicateGuardReason: undefined, undoStatus: undefined, completedAt: undefined } : t)
                : [nextTask, ...prev];
        });
        try {
            const currentTags = new Set<string>();
            itemsRef.current.forEach(i => i.meta?.tags?.forEach(t => currentTags.add(t)));

            setParsingTasks(prev => prev.map(t => t.id === tempId ? { ...t, stage: 'router' } : t));

            const routed = await routeBatchParserInput(
                text,
                {
                    existingTags: Array.from(currentTags),
                    availableSkills: skillsRef.current,
                    availableWallets: walletsRef.current,
                    availableBudgetRules: budgetConfigRef.current?.rules || [],
                    existingItems: itemsRef.current,
                },
                async (batchText, batchCandidates) => {
                    if (batchCandidates.length > 1) {
                        setParsingTasks(prev => prev.map(t => t.id === tempId ? { ...t, stage: 'batch' } : t));
                    }

                    if (appSettingsRef.current.parserModelRouting?.enabled === true) {
                        return runFastThenDeepParserModelRouting({
                            text: batchText,
                            candidateCount: batchCandidates.length || 1,
                            settings: appSettingsRef.current.parserModelRouting,
                            fastParser: async (model) => {
                                setParsingTasks(prev => prev.map(t => t.id === tempId ? { ...t, stage: 'fast_extraction' } : t));
                                const legacy = await classifyText(
                                    batchText,
                                    Array.from(currentTags),
                                    skillsRef.current.map(s => s.name),
                                    0,
                                    customPromptRef.current,
                                    model,
                                    walletsRef.current,
                                    budgetConfigRef.current?.rules || []
                                );
                                return convertLegacyResultsToNative(legacy, batchText);
                            },
                            deepParser: async (model) => {
                                setParsingTasks(prev => prev.map(t => t.id === tempId ? { ...t, stage: 'deep_parse' } : t));
                                return parsePro(
                                    batchText,
                                    Array.from(currentTags),
                                    skillsRef.current,
                                    walletsRef.current,
                                    budgetConfigRef.current?.rules || [],
                                    itemsRef.current,
                                    customPromptRef.current,
                                    model,
                                    0,
                                    (stage) => {
                                        setParsingTasks(prev => prev.map(t => t.id === tempId ? { ...t, stage } : t));
                                    }
                                );
                            },
                        });
                    }

                    if (appSettingsRef.current.useProParser) {
                        setParsingTasks(prev => prev.map(t => t.id === tempId ? { ...t, stage: 'stage1' } : t));
                        return parsePro(
                            batchText,
                            Array.from(currentTags),
                            skillsRef.current,
                            walletsRef.current,
                            budgetConfigRef.current?.rules || [],
                            itemsRef.current,
                            customPromptRef.current,
                            appSettingsRef.current.parsingModel,
                            0,
                            (stage) => {
                                setParsingTasks(prev => prev.map(t => t.id === tempId ? { ...t, stage } : t));
                            }
                        );
                    }

                    setParsingTasks(prev => prev.map(t => t.id === tempId ? { ...t, stage: 'legacy' } : t));
                    const legacy = await classifyText(
                        batchText,
                        Array.from(currentTags),
                        skillsRef.current.map(s => s.name),
                        0,
                        customPromptRef.current,
                        appSettingsRef.current.parsingModel,
                        walletsRef.current,
                        budgetConfigRef.current?.rules || []
                    );
                    return convertLegacyResultsToNative(legacy, batchText);
                }
            );

            if (routed.decision.batch) {
                setParsingTasks(prev => prev.map(t => t.id === tempId ? { ...t, stage: 'batch', batch: routed.decision.batch } : t));
            } else if (routed.decision.route !== 'deep_ai') {
                setParsingTasks(prev => prev.map(t => t.id === tempId ? { ...t, stage: 'local' } : t));
            }

            console.debug('[parser-router]', {
                taskId: tempId,
                route: routed.decision.route,
                intent: routed.decision.intent,
                confidenceScore: routed.decision.confidenceScore,
                reasonCodes: routed.decision.reasonCodes,
            });

            let parsedResults: ParserResultV2[] = routed.results;
            const enableDraftReview = appSettingsRef.current.enableDraftReview ?? false;
            const batchNeedsReview = (routed.decision.batch?.reviewItemCount || 0) > 0 || routed.results.some(result => result.needsReview);
            const requiresParserReview = routed.decision.route === 'review' || batchNeedsReview || (enableDraftReview && routed.decision.route === 'deep_ai');

            if (requiresParserReview) {
                parsedResults = canonicalizeParserResults(parsedResults, {
                    existingItems: itemsRef.current,
                    wallets: walletsRef.current,
                    budgetRules: budgetConfigRef.current?.rules || [],
                    rules: [...getSystemCanonicalRules(walletsRef.current), ...canonicalRulesRef.current],
                });
            }

            const guardedResults = guardParserResultMultiplicity(parsedResults, text);
            parsedResults = guardedResults.results;

            const originalResults = structuredClone(parsedResults);
            
            if (requiresParserReview) {
                setPendingReviews(prev => [{ id: tempId, text, results: parsedResults, originalResults }, ...prev]);
            } else {
                executeParserResults(parsedResults, text, tempId);
                enqueueEnrichmentForParserTask(tempId, text);
            }

            setParsingTasks(prev => prev.map(t => t.id === tempId ? {
                ...t,
                status: 'success',
                results: parsedResults,
                routerDecision: routed.decision,
                batch: routed.decision.batch,
                duplicateGuardRemovedCount: guardedResults.removedCount || undefined,
                duplicateGuardReason: guardedResults.reason,
                completedAt: Date.now()
            } : t));
        } catch (err: any) {
            console.error("Processing failed", err);
            setParsingTasks(prev => prev.map(t => t.id === tempId ? { ...t, status: 'failed', error: err.message || 'Unknown error', completedAt: Date.now() } : t));
        } finally {
            parsingInFlightRef.current.delete(tempId);
            setPendingCount(prev => Math.max(0, prev - 1));
            flushDeferredSyncAfterParsing();
        }
    };

    const retryParsing = (taskId: string) => {
        const task = parsingTasks.find(t => t.id === taskId);
        if (!task) return;
        
        setParsingTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'pending', error: undefined, stage: undefined, routerDecision: undefined, batch: undefined, duplicateGuardRemovedCount: undefined, duplicateGuardReason: undefined, undoStatus: undefined } : t));
        setPendingCount(prev => prev + 1);
        
        processItemInBackground(task.text, taskId);
    };

    const clearParsingTask = (taskId: string) => {
        setParsingTasks(prev => prev.filter(t => t.id !== taskId));
        delete parsingUndoSnapshotsRef.current[taskId];
    };

    const getResultTargetItemId = (result: ParserResultV2): string | undefined => {
        const payload = result.payload as UpdateItemPayload | CompleteItemPayload | DeleteItemPayload | undefined;
        if (payload && 'match' in payload) return payload.match?.itemId || result.entityRefs?.itemId;
        return result.entityRefs?.itemId;
    };

    const undoSuccessfulParsingTask = (taskId: string) => {
        const task = parsingTasks.find(t => t.id === taskId);
        const snapshot = parsingUndoSnapshotsRef.current[taskId];
        if (!task || task.status !== 'success' || !snapshot || task.undoStatus) return;

        const targetIdsToRestore = new Set<string>();
        let shouldRestoreSkills = false;
        let shouldRestoreWallets = false;
        let shouldRestoreThemes = false;

        task.results?.forEach(result => {
            if (result.action === 'update_item' || result.action === 'complete_item' || result.action === 'delete_item') {
                const targetId = getResultTargetItemId(result);
                if (targetId) targetIdsToRestore.add(targetId);
            }
            if (result.action === 'create_skill' || result.action === 'update_skill') shouldRestoreSkills = true;
            if (result.action === 'create_wallet' || result.action === 'update_wallet') shouldRestoreWallets = true;
            if (result.action === 'create_theme' || result.action === 'update_theme') shouldRestoreThemes = true;
        });

        const previousItemsById = new Map(snapshot.items.map(item => [item.id, item]));

        setItems(prev => {
            let updated = prev.filter(item => item.meta?.parserTaskId !== taskId);

            if (targetIdsToRestore.size > 0) {
                updated = updated.map(item => targetIdsToRestore.has(item.id) && previousItemsById.has(item.id)
                    ? previousItemsById.get(item.id)!
                    : item);

                const existingIds = new Set(updated.map(item => item.id));
                const missingRestoredItems = snapshot.items.filter(item => targetIdsToRestore.has(item.id) && !existingIds.has(item.id));
                updated = [...missingRestoredItems, ...updated];
            }

            saveAndSync(
                updated,
                undefined,
                undefined,
                shouldRestoreSkills ? snapshot.skills : undefined,
                shouldRestoreWallets ? snapshot.wallets : undefined,
                shouldRestoreThemes ? snapshot.monthlyThemes : undefined,
                undefined,
                snapshot.canonicalRules
            );

            return updated;
        });

        if (shouldRestoreSkills) setSkills(snapshot.skills);
        if (shouldRestoreWallets) setWallets(snapshot.wallets);
        if (shouldRestoreThemes) setMonthlyThemes(snapshot.monthlyThemes);
        setCanonicalRules(snapshot.canonicalRules);
        setParsingTasks(prev => prev.map(t => t.id === taskId ? { ...t, undoStatus: 'undone' } : t));
    };

    const deleteSuccessfulParsingTaskEntries = (taskId: string) => {
        const task = parsingTasks.find(t => t.id === taskId);
        if (!task || task.status !== 'success' || task.undoStatus) return;

        const createdItems = itemsRef.current.filter(item => item.meta?.parserTaskId === taskId);
        if (createdItems.length === 0) return;

        if (typeof window !== 'undefined' && !window.confirm(`Delete ${createdItems.length} saved entr${createdItems.length === 1 ? 'y' : 'ies'} from this successful parse?`)) {
            return;
        }

        const createdItemIds = new Set(createdItems.map(item => item.id));
        setItems(prev => {
            const updated = prev.filter(item => !createdItemIds.has(item.id));
            saveAndSync(updated);
            return updated;
        });
        setParsingTasks(prev => prev.map(t => t.id === taskId ? { ...t, undoStatus: 'deleted' } : t));
    };

    const handleApproveReview = (id: string, updatedResults: ParserResultV2[]) => {
        const review = pendingReviews.find(r => r.id === id);
        if (!review) return;

        const nextCanonicalRules = learnCanonicalRulesFromReview({
            originalResults: review.originalResults,
            approvedResults: updatedResults,
            existingRules: canonicalRulesRef.current
        });

        setCanonicalRules(nextCanonicalRules);
        const guardedResults = guardParserResultMultiplicity(updatedResults, review.text).results;
        executeParserResults(guardedResults, review.text, id, nextCanonicalRules);
        setPendingReviews(prev => prev.filter(r => r.id !== id));
    };

    const handleRejectReview = (id: string) => {
        setPendingReviews(prev => prev.filter(r => r.id !== id));
        setItems(prev => {
            const updated = prev.filter(i => i.id !== id);
            saveAndSync(updated);
            return updated;
        });
    };

    const handleSend = async (text: string) => {
        setPendingCount(prev => prev + 1);
        setError(null);

        const tempId = uuidv4();

        processItemInBackground(text, tempId);
    };

    const handleToggleStatus = async (id: string) => {
        const prevItems = itemsRef.current;
        const targetItem = prevItems.find(i => i.id === id);
        if (!targetItem) return;
        if (targetItem.type === ItemType.FINANCE) return;
        const isSavingGoal = targetItem.type === ItemType.SHOPPING && targetItem.meta.shoppingCategory === 'saving';

        const newStatus: 'pending' | 'done' = targetItem.status === 'pending' ? 'done' : 'pending';
        const completedAt = newStatus === 'done' ? new Date().toISOString() : undefined;
        const newProgress = newStatus === 'done' ? 100 : 0;
        const newProgressNotes = targetItem.meta.progressNotes;

        const isShoppingRoutine = targetItem.type === ItemType.SHOPPING && targetItem.meta.shoppingCategory === 'routine';
        const isTodoRoutine = targetItem.type === ItemType.TODO && targetItem.meta.isRoutine;

        let historyItemIdToCreate: string | undefined;
        let historyItemIdToDelete: string | undefined;

        if (newStatus === 'done' && (isShoppingRoutine || isTodoRoutine)) {
            historyItemIdToCreate = uuidv4();
        } else if (newStatus === 'pending' && (isShoppingRoutine || isTodoRoutine)) {
            historyItemIdToDelete = targetItem.meta.lastGeneratedHistoryId;
        }

        let updatedItems = prevItems.map(item =>
            item.id === id ? {
                ...item,
                status: newStatus,
                completed_at: completedAt,
                meta: {
                    ...item.meta,
                    progress: newProgress,
                    progressNotes: newProgressNotes,
                    lastGeneratedHistoryId: historyItemIdToCreate ? historyItemIdToCreate : (newStatus === 'pending' ? undefined : item.meta.lastGeneratedHistoryId)
                }
            } : item
        );

        if (historyItemIdToDelete) {
            updatedItems = updatedItems.filter(i => i.id !== historyItemIdToDelete);
        }

        if (historyItemIdToCreate) {
            let newType: ItemType = targetItem.type;
            let newMeta = { ...targetItem.meta, isRoutine: false };

            if (isShoppingRoutine) {
                newType = ItemType.FINANCE;
                newMeta = {
                    ...newMeta,
                    financeType: 'expense',
                    shoppingCategory: undefined,
                    amount: targetItem.meta.amount,
                    budgetCategory: targetItem.meta.budgetCategory,
                    paymentMethod: targetItem.meta.paymentMethod
                };
            } else if (isTodoRoutine) {
                newType = ItemType.JOURNAL;
                newMeta = {
                    ...newMeta,
                    progress: undefined,
                    progressNotes: undefined
                };
            }

            const historyItem: BrainDumpItem = {
                ...targetItem,
                id: historyItemIdToCreate,
                type: newType,
                status: 'done',
                created_at: completedAt || new Date().toISOString(),
                completed_at: completedAt,
                meta: {
                    ...newMeta,
                    date: completedAt || new Date().toISOString()
                }
            };

            updatedItems.push(historyItem);
        }

        if (isSavingGoal) {
            const savedAmount = prevItems
                .filter(item => item.type === ItemType.FINANCE && item.status === 'done' && item.meta.financeType === 'saving' && item.meta.savingGoalId === targetItem.id)
                .reduce((sum, item) => sum + (item.meta.amount || 0), 0);

            const achievedGoalItems = updatedItems.filter(item =>
                item.type === ItemType.FINANCE && (
                    ((item.meta.financeType === ACHIEVED_GOAL_FINANCE_TYPE || isLegacyCompletedGoalContent(item.content)) && item.meta.savingGoalId === targetItem.id) ||
                    (isLegacyCompletedGoalContent(item.content) && getAchievedGoalName(item.content).toLowerCase() === targetItem.content.trim().toLowerCase())
                )
            );

            if (newStatus === 'done') {
                const existingAchieved = achievedGoalItems.find(item => item.meta.financeType === ACHIEVED_GOAL_FINANCE_TYPE)
                    || achievedGoalItems.find(item => isLegacyCompletedGoalContent(item.content));

                if (existingAchieved) {
                    updatedItems = updatedItems.map(item => item.id !== existingAchieved.id ? item : {
                        ...item,
                        content: `Completed Goal: ${targetItem.content}`,
                        status: 'done',
                        completed_at: item.completed_at || completedAt,
                        meta: {
                            ...item.meta,
                            amount: item.meta.amount || savedAmount || targetItem.meta.amount,
                            financeType: ACHIEVED_GOAL_FINANCE_TYPE,
                            paymentMethod: targetItem.meta.dedicatedWalletId || item.meta.paymentMethod || targetItem.meta.paymentMethod,
                            savingGoalId: targetItem.id,
                            date: item.meta.date || completedAt,
                            tags: Array.from(new Set([...(item.meta.tags || []), 'achieved-goal']))
                        }
                    });
                } else {
                    updatedItems = [{
                        id: uuidv4(),
                        type: ItemType.FINANCE,
                        content: `Completed Goal: ${targetItem.content}`,
                        status: 'done',
                        created_at: completedAt || new Date().toISOString(),
                        completed_at: completedAt,
                        meta: {
                            tags: ['achieved-goal'],
                            amount: savedAmount || targetItem.meta.amount,
                            paymentMethod: targetItem.meta.dedicatedWalletId || targetItem.meta.paymentMethod,
                            financeType: ACHIEVED_GOAL_FINANCE_TYPE,
                            savingGoalId: targetItem.id,
                            date: completedAt
                        }
                    }, ...updatedItems];
                }
            } else {
                const achievedIds = new Set(
                    achievedGoalItems
                        .filter(item => item.meta.financeType === ACHIEVED_GOAL_FINANCE_TYPE || isLegacyCompletedGoalContent(item.content))
                        .map(item => item.id)
                );
                updatedItems = updatedItems.filter(item => !achievedIds.has(item.id));
            }
        }

        updatedItems = applyDeepWorkCompletionSemantics(applyDeepWorkChildProgress(updatedItems));
        setItems(updatedItems);
        saveAndSync(updatedItems);
    };

    const handleResetRoutine = async (id: string) => {
        const prev = itemsRef.current;
        const item = prev.find(i => i.id === id);

        const isShoppingRoutine = item?.type === ItemType.SHOPPING && item?.meta.shoppingCategory === 'routine';
        const isTodoRoutine = item?.type === ItemType.TODO && item?.meta.isRoutine;

        if (!item || (!isTodoRoutine && !isShoppingRoutine) || item.status !== 'done') return;

        const updatedItem: BrainDumpItem = {
            ...item,
            status: 'pending',
            completed_at: undefined,
            meta: {
                ...item.meta,
                progress: 0,
                progressNotes: undefined,
                lastGeneratedHistoryId: undefined
            }
        };

        const updatedList = prev.map(i => i.id === id ? updatedItem : i);

        setItems(updatedList);
        saveAndSync(updatedList);
    };

    const handleDelete = async (id: string) => {
        const target = itemsRef.current.find(i => i.id === id);
        const childIds = new Set(target?.meta.childTodoIds || []);
        let updatedItems = itemsRef.current.filter(i => i.id !== id && i.meta.parentTodoId !== id && !childIds.has(i.id));
        updatedItems = applyDeepWorkChildProgress(updatedItems);
        setItems(updatedItems);
        saveAndSync(updatedItems);
    };

    const stripDeepWorkFields = stripDeepWorkFieldsFromMeta;

    const saveDeepWorkItems = (nextItems: BrainDumpItem[]) => {
        const normalized = applyDeepWorkCompletionSemantics(applyDeepWorkChildProgress(nextItems));
        setItems(normalized);
        saveAndSync(normalized);
    };

    const handleKeepRawTodo = async (id: string) => {
        const target = itemsRef.current.find(item => item.id === id);
        const childIds = new Set(target?.meta.childTodoIds || []);
        const updatedItems = itemsRef.current
            .filter(item => item.id === id || (item.meta.parentTodoId !== id && !childIds.has(item.id)))
            .map(item => {
                if (item.id !== id) return item;
                return {
                    ...item,
                    meta: {
                        ...stripDeepWorkFields(item.meta),
                        progress: item.meta.progress,
                        progressNotes: item.meta.progressNotes,
                    }
                };
            });
        saveDeepWorkItems(updatedItems);
    };

    const handleUpdateDeepWorkTodo = async (id: string, changes: Partial<ItemMeta>) => {
        const updatedItems = itemsRef.current.map(item => {
            if (item.id !== id) return item;
            return {
                ...item,
                meta: normalizeDeepWorkTodoMeta({
                    ...item.meta,
                    ...changes,
                    deepWorkPlanId: item.meta.deepWorkPlanId || item.id,
                })
            };
        });
        saveDeepWorkItems(updatedItems);
    };

    const handleRetriggerDeepWorkTodo = async (id: string) => {
        const now = new Date().toISOString();
        const target = itemsRef.current.find(item => item.id === id);
        const childIds = new Set(target?.meta.childTodoIds || []);
        const updatedItems = itemsRef.current
            .filter(item => item.id === id || (item.meta.parentTodoId !== id && !childIds.has(item.id)))
            .map(item => {
                if (item.id !== id || item.type !== ItemType.TODO) return item;
                const baseMeta = stripDeepWorkFields(item.meta);
                const regeneratedMeta = buildDeepWorkSuggestionMeta(item.content, {
                    ...baseMeta,
                    deepWorkGeneratedAt: now,
                });
                return {
                    ...item,
                    meta: normalizeDeepWorkTodoMeta({
                        ...regeneratedMeta,
                        deepWorkPlanId: item.id,
                        progress: regeneratedMeta.progress ?? item.meta.progress ?? 0,
                    })
                };
            });
        saveDeepWorkItems(updatedItems);
    };

    const handleAcceptDeepWorkTodo = async (id: string, subtasks?: string[]) => {
        const now = new Date().toISOString();
        let childItems: BrainDumpItem[] = [];
        const updatedParents = itemsRef.current.map(item => {
            if (item.id !== id || item.type !== ItemType.TODO) return item;
            const parentForChildren: BrainDumpItem = {
                ...item,
                meta: normalizeDeepWorkTodoMeta({
                    ...item.meta,
                    childTodoIds: undefined,
                    deepWorkPlanId: item.meta.deepWorkPlanId || item.id,
                    subtasks: subtasks?.length ? subtasks : item.meta.subtasks,
                })
            };
            childItems = createDeepWorkSubtaskItems(parentForChildren, uuidv4, now);
            const childIds = childItems.map(child => child.id);
            return {
                ...parentForChildren,
                meta: normalizeDeepWorkTodoMeta({
                    ...parentForChildren.meta,
                    childTodoIds: childIds.length ? childIds : parentForChildren.meta.childTodoIds,
                    deepWorkParent: true,
                    deepWorkPlanId: parentForChildren.meta.deepWorkPlanId || parentForChildren.id,
                    deepWorkStatus: childIds.length ? 'active' : 'accepted',
                    deepWorkCompletionMode: parentForChildren.meta.deepWorkCompletionMode || 'final_output_check',
                    progress: parentForChildren.meta.progress ?? 0,
                    subtasks: subtasks?.length ? subtasks : parentForChildren.meta.subtasks,
                })
            };
        });

        const withoutExistingChildren = updatedParents.filter(item => item.id === id || (item.meta.parentTodoId !== id && !(itemsRef.current.find(parent => parent.id === id)?.meta.childTodoIds || []).includes(item.id)));
        saveDeepWorkItems([...childItems, ...withoutExistingChildren]);
    };

    const handleAddRoutineTask = async (
        content: string,
        interval: 'daily' | 'weekly' | 'monthly' | 'yearly',
        daysOfWeek?: number[],
        daysOfMonth?: number[],
        monthsOfYear?: number[],
        customDate?: string,
        recurrenceDays?: number,
        priority: Priority = 'normal'
    ) => {
        let initialNextDue = customDate ? new Date(customDate) : calculateFirstDueDate(
            new Date(),
            interval,
            daysOfWeek,
            daysOfMonth,
            monthsOfYear
        );

        const newItem: BrainDumpItem = {
            id: uuidv4(),
            type: ItemType.TODO,
            content,
            status: 'pending',
            created_at: new Date().toISOString(),
            meta: {
                tags: ['routine'],
                isRoutine: true,
                routineInterval: interval,
                routineDaysOfWeek: daysOfWeek,
                routineDaysOfMonth: daysOfMonth,
                routineMonthsOfYear: monthsOfYear,
                recurrenceDays: recurrenceDays || 1,
                date: initialNextDue.toISOString(),
                priority
            }
        };

        const updated = [newItem, ...itemsRef.current];
        setItems(updated);
        saveAndSync(updated);
    };

    const handleUpdateItem = async (
        id: string,
        newContent: string,
        newTags: string[],
        newAmount?: number,
        newDate?: string,
        newPaymentMethod?: string,
        newBudgetCategory?: string,
        newDuration?: number,
        newSkillId?: string,
        newToWallet?: string,
        newFinanceType?: FinanceType,
        newProgress?: number,
        newProgressNotes?: string,
        newShoppingCategory?: ShoppingCategory,
        newRecurrenceDays?: number,
        newQuantity?: string,
        newIsRoutine?: boolean,
        newRoutineInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly',
        newRoutineDaysOfWeek?: number[],
        newRoutineDaysOfMonth?: number[],
        newRoutineMonthsOfYear?: number[],
        newSavingGoalId?: string,
        newDedicatedWalletId?: string,
        newPriority?: Priority,
        newStart?: string,
        newEnd?: string,
        newHideFromCalendar?: boolean,
        newInvestmentAssetType?: InvestmentAssetType,
        newInvestmentSymbol?: string,
        newInvestmentUnits?: number,
        newInvestmentAveragePrice?: number,
        newInvestmentCurrentPrice?: number,
        newInvestmentPlatform?: string,
        newCommodity?: string,
        newSubcommodity?: string,
        newNoteTitle?: string
    ) => {
        const updatedItems = itemsRef.current.map(item => {
            if (item.id !== id) return item;

            let newStatus = item.status;
            let completedAt = item.completed_at;

            if (newProgress !== undefined) {
                if (newProgress === 100 && item.status === 'pending') {
                    newStatus = 'done';
                    completedAt = new Date().toISOString();
                } else if (newProgress < 100 && item.status === 'done') {
                    newStatus = 'pending';
                    completedAt = undefined;
                }
            }

            const editsShoppingCompletionDate = item.type === ItemType.SHOPPING && shouldShoppingDateEditCompletion(item) && newDate !== undefined;
            let finalDate = editsShoppingCompletionDate ? item.meta.date : (newDate || item.meta.date);
            let finalCompletedAt = completedAt;

            if (editsShoppingCompletionDate) {
                finalCompletedAt = newDate;
            }

            if (!newDate && (newIsRoutine || item.meta.isRoutine)) {
                const interval = newRoutineInterval || item.meta.routineInterval || 'daily';
                const daysOfWeek = newRoutineDaysOfWeek || item.meta.routineDaysOfWeek;
                const daysOfMonth = newRoutineDaysOfMonth || item.meta.routineDaysOfMonth;
                const monthsOfYear = newRoutineMonthsOfYear || item.meta.routineMonthsOfYear;

                if (item.status === 'pending') {
                    const scheduleChanged =
                        interval !== item.meta.routineInterval ||
                        JSON.stringify(daysOfWeek) !== JSON.stringify(item.meta.routineDaysOfWeek) ||
                        JSON.stringify(daysOfMonth) !== JSON.stringify(item.meta.routineDaysOfMonth) ||
                        JSON.stringify(monthsOfYear) !== JSON.stringify(item.meta.routineMonthsOfYear);

                    if (scheduleChanged) {
                        const nextDue = calculateFirstDueDate(new Date(), interval, daysOfWeek, daysOfMonth, monthsOfYear);
                        finalDate = nextDue.toISOString();
                    }
                }
            }

            const mergedMeta = refreshDeepWorkSuggestionForTodo(item.type, newStatus, newContent, {
                ...item.meta,
                tags: newTags,
                title: newNoteTitle !== undefined ? (newNoteTitle.trim() || undefined) : item.meta.title,
                amount: newAmount,
                date: finalDate,
                start: newStart !== undefined ? newStart : item.meta.start,
                end: newEnd !== undefined ? newEnd : item.meta.end,
                hideFromCalendar: newHideFromCalendar !== undefined ? newHideFromCalendar : item.meta.hideFromCalendar,
                paymentMethod: newPaymentMethod,
                budgetCategory: newBudgetCategory,
                commodity: newCommodity !== undefined ? (newCommodity || undefined) : item.meta.commodity,
                subcommodity: newSubcommodity !== undefined ? (newSubcommodity || undefined) : item.meta.subcommodity,
                durationMinutes: newDuration,
                skillId: newSkillId,
                toWallet: newToWallet,
                financeType: newFinanceType || item.meta.financeType,
                progress: newProgress,
                progressNotes: newProgressNotes,
                shoppingCategory: newShoppingCategory || item.meta.shoppingCategory,
                recurrenceDays: newRecurrenceDays !== undefined ? newRecurrenceDays : item.meta.recurrenceDays,
                quantity: newQuantity !== undefined ? newQuantity : item.meta.quantity,
                isRoutine: newIsRoutine !== undefined ? newIsRoutine : item.meta.isRoutine,
                routineInterval: newRoutineInterval || item.meta.routineInterval,
                routineDaysOfWeek: newRoutineDaysOfWeek || item.meta.routineDaysOfWeek,
                routineDaysOfMonth: newRoutineDaysOfMonth || item.meta.routineDaysOfMonth,
                routineMonthsOfYear: newRoutineMonthsOfYear || item.meta.routineMonthsOfYear,
                savingGoalId: newSavingGoalId || item.meta.savingGoalId,
                dedicatedWalletId: newDedicatedWalletId || item.meta.dedicatedWalletId,
                priority: newPriority !== undefined ? newPriority : item.meta.priority,
                investmentAssetType: newInvestmentAssetType || item.meta.investmentAssetType,
                investmentSymbol: newInvestmentSymbol !== undefined ? newInvestmentSymbol : item.meta.investmentSymbol,
                investmentUnits: newInvestmentUnits !== undefined ? newInvestmentUnits : item.meta.investmentUnits,
                investmentAveragePrice: newInvestmentAveragePrice !== undefined ? newInvestmentAveragePrice : item.meta.investmentAveragePrice,
                investmentCurrentPrice: newInvestmentCurrentPrice !== undefined ? newInvestmentCurrentPrice : item.meta.investmentCurrentPrice,
                investmentPlatform: newInvestmentPlatform !== undefined ? newInvestmentPlatform : item.meta.investmentPlatform
            });

            return {
                ...item,
                content: newContent,
                status: newStatus,
                completed_at: finalCompletedAt,
                meta: mergedMeta
            };
        });

        const reconciledDeepWorkItems = applyDeepWorkCompletionSemantics(applyDeepWorkChildProgress(updatedItems));
        setItems(reconciledDeepWorkItems);
        saveAndSync(reconciledDeepWorkItems);
    };

    const handleAddTask = async (content: string, date: string, priority: Priority = 'normal', start?: string, end?: string, hideFromCalendar?: boolean) => {
        const newItems = buildItemsFromCreatePayload(
            {
                action: 'create_item',
                entityType: 'todo',
                content,
                confidence: 'high',
                needsReview: false,
                payload: {
                    itemType: 'TODO',
                    content,
                    status: 'pending',
                    meta: { date, priority, start, end, hideFromCalendar }
                }
            },
            {
                itemType: 'TODO',
                content,
                status: 'pending',
                meta: { date, priority, start, end, hideFromCalendar }
            },
            content
        );

        const updated = [...newItems, ...itemsRef.current];
        setItems(updated);
        saveAndSync(updated);
    };

    const handleAcceptDeepWorkPlan = (id: string) => {
        const currentItems = itemsRef.current;
        const parent = currentItems.find(item => item.id === id && item.type === ItemType.TODO);
        if (!parent) return;

        const parentWithSuggestion: BrainDumpItem = {
            ...parent,
            meta: normalizeDeepWorkTodoMeta(buildDeepWorkSuggestionMeta(parent.content, parent.meta))
        };
        const now = new Date().toISOString();
        const childItems = createDeepWorkSubtaskItems(parentWithSuggestion, uuidv4, now);
        if (childItems.length === 0) return;

        const childIds = childItems.map(child => child.id);
        const updatedParent: BrainDumpItem = {
            ...parentWithSuggestion,
            meta: normalizeDeepWorkTodoMeta({
                ...parentWithSuggestion.meta,
                deepWorkStatus: 'active',
                childTodoIds: childIds,
                deepWorkPlanId: parentWithSuggestion.meta.deepWorkPlanId || parentWithSuggestion.id,
                deepWorkAcceptedAt: now,
                progress: 0,
            })
        };

        const withoutParent = currentItems.filter(item => item.id !== id);
        const updated = applyDeepWorkCompletionSemantics(applyDeepWorkChildProgress([updatedParent, ...childItems, ...withoutParent]));
        setItems(updated);
        saveAndSync(updated);
    };

    const handleDismissDeepWorkPlan = (id: string) => {
        const updated = itemsRef.current.map(item => {
            if (item.id !== id || item.type !== ItemType.TODO) return item;
            return {
                ...item,
                meta: normalizeDeepWorkTodoMeta({
                    ...item.meta,
                    deepWorkParent: false,
                    deepWorkStatus: 'dismissed',
                    deepWorkDismissedAt: new Date().toISOString(),
                    subtasks: undefined,
                })
            };
        });
        setItems(updated);
        saveAndSync(updated);
    };

    const handleAddShoppingItem = async (
        content: string,
        category: ShoppingCategory,
        quantity?: string,
        amount?: number,
        budgetCategory?: string,
        date?: string,
        routineInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly',
        routineDaysOfWeek?: number[],
        routineDaysOfMonth?: number[],
        routineMonthsOfYear?: number[],
        dedicatedWalletId?: string,
        paymentMethod?: string,
        hideFromCalendar?: boolean,
        investmentAssetType?: InvestmentAssetType,
        investmentSymbol?: string,
        investmentUnits?: number,
        investmentAveragePrice?: number,
        investmentCurrentPrice?: number,
        investmentPlatform?: string
    ) => {
        const normalizedInvestmentPlatform = category === 'investment' ? investmentPlatform?.trim() : undefined;
        let updatedWallets = walletsRef.current;
        let investmentWalletId: string | undefined;

        if (category === 'investment' && normalizedInvestmentPlatform) {
            const existingWallet = walletsRef.current.find(wallet => wallet.name.trim().toLowerCase() === normalizedInvestmentPlatform.toLowerCase());
            if (existingWallet) {
                investmentWalletId = existingWallet.id;
            } else {
                const newInvestmentWallet: Wallet = {
                    id: uuidv4(),
                    name: normalizedInvestmentPlatform,
                    type: 'investment',
                    initialBalance: 0,
                    color: 'bg-emerald-500'
                };
                updatedWallets = [newInvestmentWallet, ...walletsRef.current];
                investmentWalletId = newInvestmentWallet.id;
                setWallets(updatedWallets);
            }
        }

        const newItem: BrainDumpItem = {
            id: uuidv4(),
            type: ItemType.SHOPPING,
            content,
            status: 'pending',
            created_at: new Date().toISOString(),
            meta: {
                tags: [],
                shoppingCategory: category,
                quantity,
                amount: category === 'investment' ? undefined : amount,
                budgetCategory,
                date: date || new Date().toISOString(),
                isRoutine: category === 'routine',
                routineInterval: category === 'routine' ? routineInterval : undefined,
                routineDaysOfWeek: category === 'routine' ? routineDaysOfWeek : undefined,
                routineDaysOfMonth: category === 'routine' ? routineDaysOfMonth : undefined,
                routineMonthsOfYear: category === 'routine' ? routineMonthsOfYear : undefined,
                dedicatedWalletId: category === 'saving' ? dedicatedWalletId : (category === 'investment' ? investmentWalletId : undefined),
                paymentMethod,
                hideFromCalendar,
                investmentAssetType: category === 'investment' ? investmentAssetType : undefined,
                investmentSymbol: category === 'investment' ? investmentSymbol : undefined,
                investmentUnits: category === 'investment' ? investmentUnits : undefined,
                investmentAveragePrice: category === 'investment' ? investmentAveragePrice : undefined,
                investmentCurrentPrice: category === 'investment' ? investmentCurrentPrice : undefined,
                investmentPlatform: category === 'investment' ? normalizedInvestmentPlatform : undefined
            }
        };

        const updated = [newItem, ...itemsRef.current];
        setItems(updated);
        saveAndSync(updated, undefined, undefined, undefined, updatedWallets);
    };

    const handleAddSavingTransaction = (
        amount: number,
        walletId: string,
        date: string,
        goalId: string,
        goalName: string,
        toWalletId?: string,
        investmentUnits?: number,
        investmentUnitPrice?: number
    ) => {
        const resolvedFunding = resolveInvestmentFundingInput({
            investedCapital: amount,
            units: investmentUnits,
            unitPrice: investmentUnitPrice
        });
        const normalizedAmount = resolvedFunding.investedCapital || amount;
        const isInvestmentFunding = !!toWalletId;
        const newFinanceItem: BrainDumpItem = {
            id: uuidv4(),
            type: ItemType.FINANCE,
            content: isInvestmentFunding ? `Invested into: ${goalName}` : `Saved for: ${goalName}`,
            status: 'done',
            created_at: new Date().toISOString(),
            completed_at: new Date(date).toISOString(),
            meta: {
                tags: [],
                amount: normalizedAmount,
                date: new Date(date).toISOString(),
                paymentMethod: walletId,
                toWallet: toWalletId,
                financeType: 'saving',
                savingGoalId: goalId,
                investmentUnits: isInvestmentFunding ? resolvedFunding.units : undefined,
                investmentAveragePrice: isInvestmentFunding ? resolvedFunding.unitPrice : undefined
            }
        };

        const updatedItems = itemsRef.current.map(item => {
            if (!isInvestmentFunding || item.id !== goalId || item.type !== ItemType.SHOPPING || item.meta.shoppingCategory !== 'investment') return item;
            return applyInvestmentFundingToInvestment(item, resolvedFunding);
        });
        const updated = [newFinanceItem, ...updatedItems];
        setItems(updated);
        saveAndSync(updated);
    };

    const handleAddTransaction = async (
        content: string,
        amount: number,
        type: FinanceType,
        paymentMethod?: string,
        budgetCategory?: string,
        toWallet?: string,
        date?: string
    ) => {
        const newItem: BrainDumpItem = {
            id: uuidv4(),
            type: ItemType.FINANCE,
            content,
            status: 'done',
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            meta: {
                tags: [],
                amount,
                financeType: type,
                paymentMethod,
                budgetCategory,
                toWallet,
                date: date || new Date().toISOString()
            }
        };

        const updated = [newItem, ...itemsRef.current];
        setItems(updated);
        saveAndSync(updated);
    };

    const handleAddNote = async (title: string, content: string, tags: string[], type: ItemType.NOTE | ItemType.JOURNAL = ItemType.NOTE) => {
        const now = new Date().toISOString();
        const cleanTitle = title.trim() || undefined;

        const newItem: BrainDumpItem = type === ItemType.JOURNAL
            ? {
                id: uuidv4(),
                type: ItemType.JOURNAL,
                content,
                status: 'done',
                created_at: now,
                completed_at: now,
                meta: {
                    title: cleanTitle,
                    tags,
                    date: now
                }
            }
            : {
                id: uuidv4(),
                type: ItemType.NOTE,
                content,
                status: 'pending',
                created_at: now,
                meta: {
                    title: cleanTitle,
                    tags
                }
            };

        const updated = type === ItemType.JOURNAL
            ? upsertDailyJournalEntry(itemsRef.current, newItem)
            : [newItem, ...itemsRef.current];
        setItems(updated);
        saveAndSync(updated);
    };

    return {
        items,
        budgetConfig,
        setBudgetConfig,
        skills,
        setSkills,
        wallets,
        setWallets,
        customPrompt,
        setCustomPrompt,
        monthlyThemes,
        setMonthlyThemes,
        appSettings,
        setAppSettings,
        chatHistory,
        setChatHistory,
        loading,
        error,
        pendingCount,
        parsingTasks,
        enrichmentTasks,
        pendingReviews,
        canonicalRules,
        saveStatus,
        fetchStatus,
        loadData,
        saveAndSync,
        runCanonicalBackfill,
        toggleCanonicalRuleDisabled,
        handleSend,
        retryParsing,
        clearParsingTask,
        undoSuccessfulParsingTask,
        deleteSuccessfulParsingTaskEntries,
        handleApproveReview,
        handleRejectReview,
        handleToggleStatus,
        handleDelete,
        handleUpdateItem,
        handleKeepRawTodo,
        handleUpdateDeepWorkTodo,
        handleRetriggerDeepWorkTodo,
        handleAcceptDeepWorkTodo,
        handleAddRoutineTask,
        handleAddTask,
        handleAddShoppingItem,
        handleAddSavingTransaction,
        handleAcceptDeepWorkPlan,
        handleDismissDeepWorkPlan,
        handleResetRoutine,
        handleAddTransaction,
        handleAddNote
    };
};
