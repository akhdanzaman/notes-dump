import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Moon, 
  Sun, 
  Wallet as WalletIcon, 
  DollarSign, 
  Cloud, 
  ArrowRight, 
  Check, 
  Bot,
  Play
} from 'lucide-react';
import { AppSettings, BrainDumpItem, BudgetConfig, Wallet } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { createOnboardingSampleItems, ONBOARDING_DEFAULT_INPUT } from '../utils/onboardingExamples';

interface OnboardingProps {
  onComplete: (
    settings: AppSettings, 
    wallet: Wallet | null, 
    budget: BudgetConfig | null, 
    sampleItems: BrainDumpItem[]
  ) => void;
  onTestParsing: (text: string, context?: { wallet?: Wallet | null }) => Promise<BrainDumpItem[]>;
}

const STEPS = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'theme', title: 'Appearance' },
  { id: 'wallet', title: 'First Wallet' },
  { id: 'budget', title: 'Monthly Budget' },
  { id: 'sync', title: 'Data Sync' },
  { id: 'test', title: 'Test AI' },
];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onTestParsing }) => {
  const [currentStep, setCurrentStep] = useState(0);
  
  // State for setup
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [walletName, setWalletName] = useState('Main Bank');
  const [walletDraftId] = useState(() => uuidv4());
  const [walletBalance, setWalletBalance] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [testInput, setTestInput] = useState(ONBOARDING_DEFAULT_INPUT);
  const [testResult, setTestResult] = useState<BrainDumpItem[]>([]);
  const [testError, setTestError] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [addSamples, setAddSamples] = useState(true);

  // Apply theme immediately for preview
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleTestAI = async () => {
    if (!testInput.trim() || isTesting) return;
    setIsTesting(true);
    setTestError('');
    try {
      const previewWallet = walletName.trim()
        ? {
            id: walletDraftId,
            name: walletName.trim(),
            type: 'bank' as const,
            initialBalance: Number(walletBalance) || 0,
            color: 'indigo-500',
          }
        : null;
      const result = await onTestParsing(testInput, { wallet: previewWallet });
      setTestResult(result);
    } catch (error) {
      console.error(error);
      setTestResult([]);
      setTestError(error instanceof Error ? error.message : 'Parsing preview failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleComplete = () => {
    const settings: AppSettings = {
      defaultCollapsed: false,
      hideMoney: false,
      theme,
    };

    let newWallet: Wallet | null = null;
    if (walletName.trim()) {
      newWallet = {
        id: walletDraftId,
        name: walletName,
        type: 'bank',
        initialBalance: Number(walletBalance) || 0,
        color: 'indigo-500'
      };
    }

    let newBudget: BudgetConfig | null = null;
    if (monthlyIncome) {
      newBudget = {
        monthlyIncome: Number(monthlyIncome) || 0,
        rules: [
          { id: uuidv4(), name: 'Needs', percentage: 50, color: 'emerald-500' },
          { id: uuidv4(), name: 'Wants', percentage: 30, color: 'blue-500' },
          { id: uuidv4(), name: 'Savings', percentage: 20, color: 'purple-500' }
        ]
      };
    }

    const sampleItems = addSamples ? createOnboardingSampleItems(newWallet) : [];
    const parsedPreviewItems = testResult.map(item => ({
      ...item,
      id: uuidv4(),
      isOptimistic: false,
      meta: {
        ...item.meta,
        tags: Array.from(new Set([...(item.meta.tags || []), 'onboarding-example'])),
      },
    }));

    onComplete(settings, newWallet, newBudget, [...parsedPreviewItems, ...sampleItems]);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center text-center space-y-6 lg:max-w-3xl lg:mx-auto"
          >
            <div className="mb-2 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 ring-1 ring-indigo-500/15">
              <Sparkles className="h-9 w-9 text-indigo-500" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">Welcome to Arkaiv</h1>
            <p className="text-muted text-lg max-w-md">
              Ngarsip Harian — your AI-powered second brain for tracking expenses, tasks, notes, shopping, habits, and calendar context. This setup covers the basics; detailed tips will appear only when you first open each tab or feature.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full max-w-md text-left">
              {[
                ['Summary', 'Daily overview and review queue'],
                ['Plan', 'Tasks, shopping, routines, savings goals'],
                ['Library', 'Notes, skills, journal memory'],
                ['Money', 'Wallet ledger, budget, transactions'],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-border/75 bg-background/55 p-3.5">
                  <div className="text-sm font-bold text-primary">{title}</div>
                  <div className="text-xs text-muted mt-1 leading-relaxed">{body}</div>
                </div>
              ))}
            </div>
          </motion.div>
        );
      case 1:
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col space-y-6 w-full max-w-md lg:max-w-2xl mx-auto"
          >
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-primary">Choose your theme</h2>
              <p className="text-muted">You can always change this later in settings.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setTheme('light')}
                className={`p-6 rounded-2xl border flex flex-col items-center gap-4 transition-all ${
                  theme === 'light' 
                    ? 'border-indigo-500/40 bg-indigo-500/10 ring-4 ring-indigo-500/[0.06]' 
                    : 'border-border/80 bg-surface/70 hover:border-indigo-500/25 hover:bg-surface'
                }`}
              >
                <Sun className={`w-8 h-8 ${theme === 'light' ? 'text-indigo-500' : 'text-muted'}`} />
                <span className="font-medium text-primary">Light</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-6 rounded-2xl border flex flex-col items-center gap-4 transition-all ${
                  theme === 'dark' 
                    ? 'border-indigo-500/40 bg-indigo-500/10 ring-4 ring-indigo-500/[0.06]' 
                    : 'border-border/80 bg-surface/70 hover:border-indigo-500/25 hover:bg-surface'
                }`}
              >
                <Moon className={`w-8 h-8 ${theme === 'dark' ? 'text-indigo-500' : 'text-muted'}`} />
                <span className="font-medium text-primary">Dark</span>
              </button>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col space-y-6 w-full max-w-md lg:max-w-2xl mx-auto"
          >
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <WalletIcon className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-2xl font-bold text-primary">Set up your first wallet</h2>
              <p className="text-muted">Track your spending accurately by starting with your main account.</p>
            </div>
            <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Wallet Name</label>
                <input
                  type="text"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  placeholder="e.g., Main Bank, Cash"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-primary outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Current Balance</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">Rp</span>
                  <input
                    type="number"
                    value={walletBalance}
                    onChange={(e) => setWalletBalance(e.target.value)}
                    placeholder="0"
                    className="w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-3 text-primary outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col space-y-6 w-full max-w-md lg:max-w-2xl mx-auto"
          >
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-blue-500" />
              </div>
              <h2 className="text-2xl font-bold text-primary">Monthly Budget</h2>
              <p className="text-muted">Set your monthly income to unlock budget tracking and insights.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Monthly Income</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">Rp</span>
                  <input
                    type="number"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    placeholder="e.g., 10000000"
                    className="w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-3 text-primary outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10"
                  />
                </div>
                <p className="text-xs text-muted mt-2">
                  We'll automatically split this into 50% Needs, 30% Wants, and 20% Savings. You can adjust this later.
                </p>
              </div>
            </div>
          </motion.div>
        );
      case 4:
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col space-y-6 w-full max-w-md lg:max-w-2xl mx-auto"
          >
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Cloud className="w-8 h-8 text-purple-500" />
              </div>
              <h2 className="text-2xl font-bold text-primary">Spreadsheet-first database</h2>
              <p className="text-muted">Arkaiv now uses Google Sheets as the source of truth.</p>
            </div>
            <div className="space-y-4">
              <div className="w-full p-4 rounded-xl border-2 border-indigo-500 bg-indigo-500/10 flex items-center gap-4 text-left">
                <div className="p-2 rounded-lg bg-indigo-500/20">
                  <Cloud className="w-6 h-6 text-indigo-500" />
                </div>
                <div>
                  <h3 className="font-medium text-primary">Google Sheets DB</h3>
                  <p className="text-sm text-muted">Connect from Control Center after onboarding. Google login is optional: you can share the sheet with the service account and paste the link.</p>
                </div>
              </div>
            </div>
          </motion.div>
        );
      case 5:
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col space-y-6 w-full max-w-md lg:max-w-3xl mx-auto"
          >
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-pink-500" />
              </div>
              <h2 className="text-2xl font-bold text-primary">Test the AI</h2>
              <p className="text-muted">Type anything naturally. The AI will figure out if it's an expense, task, or note.</p>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTestAI()}
                  placeholder="e.g., Bought coffee for 35k"
                  className="w-full bg-surface border border-border rounded-xl pl-4 pr-12 py-4 text-primary outline-none transition focus:border-indigo-500/60 focus:ring-4 focus:ring-indigo-500/10 shadow-sm"
                />
                <button 
                  onClick={handleTestAI}
                  disabled={isTesting || !testInput.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                >
                  {isTesting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play className="w-5 h-5" />}
                </button>
              </div>

              {testResult.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-surface border border-border rounded-xl p-4 text-left"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-indigo-500/20 text-indigo-500 text-xs font-bold rounded uppercase">
                      {testResult.length} entr{testResult.length === 1 ? 'y' : 'ies'}
                    </span>
                    <span className="text-sm text-muted">Parsed successfully — this will be added as a real entry when you finish.</span>
                  </div>
                  <div className="space-y-2">
                    {testResult.map((item) => (
                      <div key={item.id} className="p-3 bg-surface rounded-lg border border-border/60">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[10px] font-bold text-muted uppercase">{item.type}</span>
                          <span className="text-xs text-muted">{item.status}</span>
                        </div>
                        <div className="text-sm font-semibold text-primary">{item.content}</div>
                        <pre className="mt-2 text-[10px] text-muted overflow-x-auto">
                          {JSON.stringify(item.meta, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {testError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
                  {testError}
                </div>
              )}

              <div className="pt-6 mt-6 border-t border-border flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="addSamples" 
                  checked={addSamples}
                  onChange={(e) => setAddSamples(e.target.checked)}
                  className="w-5 h-5 rounded border-border text-indigo-500 focus:ring-indigo-500 bg-surface"
                />
                <label htmlFor="addSamples" className="text-sm text-primary cursor-pointer">
                  Add sample data to help me explore the app
                </label>
              </div>
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-y-auto bg-background px-4 py-5 sm:px-8 sm:py-7 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="Arkaiv" className="h-10 w-10 rounded-xl bg-zinc-950 ring-1 ring-white/10" />
          <div>
            <div className="text-sm font-extrabold tracking-tight text-primary">Arkaiv</div>
            <div className="text-[11px] font-medium text-muted">Setup awal</div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleComplete}
          className="rounded-xl px-3 py-2 text-xs font-semibold text-muted transition-colors hover:bg-black/[0.04] hover:text-primary dark:hover:bg-white/[0.06]"
        >
          Lewati setup
        </button>
      </div>

      <div className="mx-auto mt-4 h-1 w-full max-w-7xl overflow-hidden rounded-full bg-border/70">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-1 items-center justify-center py-6 lg:py-8">
      <div className="absolute left-0 top-1/2 hidden w-64 -translate-y-1/2 rounded-[28px] border border-border/80 bg-surface/75 p-3 shadow-sm backdrop-blur-xl lg:block">
        <div className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Setup path</div>
        <div className="space-y-2">
          {STEPS.map((step, i) => (
            <div
              key={step.id}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${i === currentStep ? 'bg-indigo-500/10 text-primary ring-1 ring-inset ring-indigo-500/15' : 'text-muted'}`}
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i === currentStep ? 'bg-indigo-500 text-white' : i < currentStep ? 'bg-emerald-500/15 text-emerald-500' : 'bg-background text-muted'}`}>
                {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span>
                <span className="block text-sm font-bold">{step.title}</span>
                <span className={`block text-xs ${i === currentStep ? 'text-muted' : 'text-muted/80'}`}>{i < currentStep ? 'Done' : i === currentStep ? 'Now' : 'Next'}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-h-[460px] w-full max-w-2xl flex-col justify-center rounded-[30px] border border-border/80 bg-surface/72 p-6 shadow-sm backdrop-blur-xl sm:p-8 lg:max-w-3xl lg:p-10">
        <div className="mb-6 flex items-center justify-between lg:hidden">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{STEPS[currentStep].title}</span>
          <span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-bold text-indigo-500">{currentStep + 1}/{STEPS.length}</span>
        </div>
        <AnimatePresence mode="wait">
          <div key={currentStep} className="w-full">
            {renderStep()}
          </div>
        </AnimatePresence>

        <div className="mt-8 flex w-full items-center justify-between border-t border-border/80 pt-5">
        <button
          onClick={handleBack}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
            currentStep === 0 
              ? 'opacity-0 pointer-events-none' 
              : 'text-muted hover:bg-black/[0.04] hover:text-primary dark:hover:bg-white/[0.06]'
          }`}
        >
          Back
        </button>
        
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div 
              key={i} 
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentStep ? 'bg-indigo-500 w-6' : 'bg-border'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-500/20 transition-colors hover:bg-indigo-500"
        >
          {currentStep === STEPS.length - 1 ? (
            <>Get Started <Check className="w-5 h-5" /></>
          ) : (
            <>Next <ArrowRight className="w-5 h-5" /></>
          )}
        </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Onboarding;
