import { MutableRefObject } from 'react';
import {
  BrainDumpItem,
  BudgetConfig,
  Skill,
  Wallet,
  AppSettings,
  CanonicalRule,
  ChatMessage,
  SyncStatus,
  SyncProgress,
  ParsingTask,
  EnrichmentTask,
} from '../types';
import { HistoricalCanonicalReview } from '../services/canonicalizerService';

export type BrainDumpContext = {
  itemsRef: MutableRefObject<BrainDumpItem[]>;
  setItems: (items: BrainDumpItem[]) => void;
  saveAndSync: (
    newItems?: BrainDumpItem[],
    newConfig?: BudgetConfig,
    newPrompt?: string,
    newSkills?: Skill[],
    newWallets?: Wallet[],
    newThemes?: Record<string, string>,
    newAppSettings?: AppSettings,
    newCanonicalRules?: CanonicalRule[],
    forceOverwrite?: boolean,
    newThemeImages?: Record<string, string>,
  ) => Promise<void>;
  skillsRef: MutableRefObject<Skill[]>;
  setSkills: (skills: Skill[]) => void;
  walletsRef: MutableRefObject<Wallet[]>;
  setWallets: (wallets: Wallet[]) => void;
  monthlyThemesRef: MutableRefObject<Record<string, string>>;
  setMonthlyThemes: (themes: Record<string, string>) => void;
  monthlyThemeImagesRef: MutableRefObject<Record<string, string>>;
  setMonthlyThemeImages: (images: Record<string, string>) => void;
  budgetConfigRef: MutableRefObject<BudgetConfig>;
  customPromptRef: MutableRefObject<string>;
  appSettingsRef: MutableRefObject<AppSettings>;
  canonicalRulesRef: MutableRefObject<CanonicalRule[]>;
  setCanonicalRules: (rules: CanonicalRule[]) => void;
  chatHistoryRef: MutableRefObject<ChatMessage[]>;
  setParsingTasks: (updater: ParsingTask[] | ((prev: ParsingTask[]) => ParsingTask[])) => void;
  setEnrichmentTasks: (updater: EnrichmentTask[] | ((prev: EnrichmentTask[]) => EnrichmentTask[])) => void;
  setPendingReviews: (updater: HistoricalCanonicalReview[] | ((prev: HistoricalCanonicalReview[]) => HistoricalCanonicalReview[])) => void;
  setPendingCount: (updater: number | ((prev: number) => number)) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setSaveStatus: (status: SyncStatus) => void;
  setSaveProgress: (progress: SyncProgress | null) => void;
  setFetchProgress: (progress: SyncProgress | null) => void;
  setFetchStatus: (status: SyncStatus) => void;
  parsingInFlightRef: MutableRefObject<Set<string>>;
  pendingSaveAfterParsingRef: MutableRefObject<{
    newItems?: BrainDumpItem[];
    newConfig?: BudgetConfig;
    newPrompt?: string;
    newSkills?: Skill[];
    newWallets?: Wallet[];
    newThemes?: Record<string, string>;
    newThemeImages?: Record<string, string>;
    newAppSettings?: AppSettings;
    newCanonicalRules?: CanonicalRule[];
    forceOverwrite?: boolean;
  } | null>;
  pendingFetchAfterParsingRef: MutableRefObject<boolean>;
  parsingUndoSnapshotsRef: MutableRefObject<Record<string, any>>;
  enrichmentTasksRef: MutableRefObject<EnrichmentTask[]>;
  hasActiveParsing: () => boolean;
  loadData: () => Promise<void>;
  flushDeferredSyncAfterParsing: () => Promise<void>;
};
