import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ItemType, type AppSettings, type Wallet, type BudgetConfig, type BrainDumpItem } from '../types';
import type { useBrainDumpData } from './useBrainDumpData';
import { LATEST_CHANGELOG_VERSION, SEEN_CHANGELOG_STORAGE_KEY } from '../utils/changelog';
import { FEATURE_TUTORIALS_DISABLED_KEY, FEATURE_TUTORIALS_STORAGE_KEY, type FeatureTutorialKey, getFeatureTutorialKey, parseSeenFeatureTutorials } from '../utils/featureTutorials';

type OnboardingOptions = Pick<ReturnType<typeof useBrainDumpData>, 'items' | 'wallets' | 'skills' | 'budgetConfig' | 'customPrompt' | 'monthlyThemes' | 'appSettings' | 'setAppSettings' | 'setWallets' | 'setBudgetConfig' | 'saveAndSync'> & Parameters<typeof getFeatureTutorialKey>[0];
const readStorage = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
export function useAppOnboarding({ items, wallets, skills, budgetConfig, customPrompt, monthlyThemes, appSettings, setAppSettings, setWallets, setBudgetConfig, saveAndSync, activeTab, planSubTab, librarySubTab, moneyView, isControlCenterOpen }: OnboardingOptions) {
  // Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return readStorage("braindump_onboarding_completed") !== "true";
  });

  const [showChangelogPopup, setShowChangelogPopup] = useState(false);
  const [seenFeatureTutorials, setSeenFeatureTutorials] = useState<
    FeatureTutorialKey[]
  >(() =>
    parseSeenFeatureTutorials(
      readStorage(FEATURE_TUTORIALS_STORAGE_KEY),
    ),
  );
  const [activeFeatureTutorialKey, setActiveFeatureTutorialKey] =
    useState<FeatureTutorialKey | null>(null);
  const [featureTutorialsDisabled, setFeatureTutorialsDisabled] = useState(
    () => readStorage(FEATURE_TUTORIALS_DISABLED_KEY) === "true",
  );
  useEffect(() => {
    if (showOnboarding) return;
    try {
      const seenVersion = readStorage(SEEN_CHANGELOG_STORAGE_KEY);
      if (seenVersion !== LATEST_CHANGELOG_VERSION) {
        setShowChangelogPopup(true);
      }
    } catch (e) {
      console.warn("Failed to read changelog seen version", e);
    }
  }, [showOnboarding]);

  const handleCloseChangelogPopup = () => {
    try {
      localStorage.setItem(
        SEEN_CHANGELOG_STORAGE_KEY,
        LATEST_CHANGELOG_VERSION,
      );
    } catch (e) {
      console.warn("Failed to save changelog seen version", e);
    }
    setShowChangelogPopup(false);
  };

  const currentFeatureTutorialKey = useMemo(
    () =>
      getFeatureTutorialKey({
        activeTab,
        planSubTab,
        librarySubTab,
        moneyView,
        isControlCenterOpen,
      }),
    [activeTab, isControlCenterOpen, librarySubTab, moneyView, planSubTab],
  );

  useEffect(() => {
    if (
      showOnboarding ||
      showChangelogPopup ||
      featureTutorialsDisabled ||
      activeFeatureTutorialKey
    )
      return;
    if (seenFeatureTutorials.includes(currentFeatureTutorialKey)) return;

    const timeout = window.setTimeout(() => {
      setActiveFeatureTutorialKey(currentFeatureTutorialKey);
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [
    activeFeatureTutorialKey,
    currentFeatureTutorialKey,
    featureTutorialsDisabled,
    seenFeatureTutorials,
    showChangelogPopup,
    showOnboarding,
  ]);

  const markFeatureTutorialSeen = (key: FeatureTutorialKey) => {
    setSeenFeatureTutorials((prev) => {
      const next = prev.includes(key) ? prev : [...prev, key];
      try {
        localStorage.setItem(
          FEATURE_TUTORIALS_STORAGE_KEY,
          JSON.stringify(next),
        );
      } catch (e) {
        console.warn("Failed to save feature tutorial state", e);
      }
      return next;
    });
  };

  const handleCloseFeatureTutorial = () => {
    if (activeFeatureTutorialKey)
      markFeatureTutorialSeen(activeFeatureTutorialKey);
    setActiveFeatureTutorialKey(null);
  };

  const handleDisableFeatureTutorials = () => {
    try {
      localStorage.setItem(FEATURE_TUTORIALS_DISABLED_KEY, "true");
    } catch (e) {
      console.warn("Failed to disable feature tutorials", e);
    }
    setFeatureTutorialsDisabled(true);
    if (activeFeatureTutorialKey)
      markFeatureTutorialSeen(activeFeatureTutorialKey);
    setActiveFeatureTutorialKey(null);
  };

  const handleOnboardingComplete = (
    settings: AppSettings,
    wallet: Wallet | null,
    budget: BudgetConfig | null,
    sampleItems: BrainDumpItem[],
  ) => {
    try { localStorage.setItem("braindump_onboarding_completed", "true"); } catch { /* restricted storage */ }
    setShowOnboarding(false);

    setAppSettings(settings);

    const newWallets = wallet ? [wallet] : [];
    if (wallet) setWallets(newWallets);

    if (budget) setBudgetConfig(budget);

    saveAndSync({ data: sampleItems.length > 0 ? [...items, ...sampleItems] : items, budgetConfig: budget || budgetConfig, customPrompt: customPrompt, skills: skills, wallets: newWallets.length > 0 ? newWallets : wallets, monthlyThemes: monthlyThemes, appSettings: settings, forceOverwrite: true } // force overwrite
    );
  };

  const handleOnboardingTestParsing = async (
    text: string,
    context?: { wallet?: Wallet | null },
  ): Promise<BrainDumpItem[]> => {
    const previewWallets = context?.wallet ? [context.wallet] : wallets;
    const { classifyText } = await import('../services/geminiService');
    const parsed = await classifyText(
      text,
      [],
      skills.map((s) => s.name),
      customPrompt,
      appSettings.parsingModel,
      previewWallets,
      budgetConfig?.rules || [],
    );

    const now = new Date().toISOString();
    return parsed.map((partial) => {
      const type =
        partial.type &&
        Object.values(ItemType).includes(partial.type as ItemType)
          ? (partial.type as ItemType)
          : ItemType.NOTE;
      const isRecord =
        type === ItemType.FINANCE ||
        type === ItemType.JOURNAL ||
        type === ItemType.SKILL_LOG;
      const meta = { ...(partial.meta || {}) };
      if ((type === ItemType.TODO || type === ItemType.EVENT) && !meta.priority)
        meta.priority = "normal";
      if (type === ItemType.JOURNAL && !meta.date) meta.date = now;

      return {
        id: uuidv4(),
        type,
        content: partial.content || text,
        status: isRecord ? "done" : "pending",
        created_at: now,
        completed_at: isRecord ? now : undefined,
        meta,
        isOptimistic: false,
      };
    });
  };


  return { showOnboarding, showChangelogPopup, activeFeatureTutorialKey, handleCloseChangelogPopup, handleCloseFeatureTutorial, handleDisableFeatureTutorials, handleOnboardingComplete, handleOnboardingTestParsing };
}
