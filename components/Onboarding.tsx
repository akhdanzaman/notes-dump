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
            <div className="w-24 h-24 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-12 h-12 text-indigo-500" />
            </div>
            <h1 className="text-3xl font-bold text-primary">Welcome to BrainDump</h1>
            <p className="text-muted text-lg max-w-md">
              Your AI-powered second brain for tracking expenses, tasks, notes, shopping, habits, and calendar context. This setup covers the basics; detailed tips will appear only when you first open each tab or feature.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full max-w-md text-left">
              {[
                ['Summary', 'Daily overview and review queue'],
                ['Plan', 'Tasks, shopping, routines, savings goals'],
                ['Library', 'Notes, skills, journal memory'],
                ['Money', 'Wallet ledger, budget, transactions'],
              ].map(([title, body]) => (
                <div key={title} className="p-3 rounded-2xl bg-surface border border-border">
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
                className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all ${
                  theme === 'light' 
                    ? 'border-indigo-500 bg-indigo-500/10' 
                    : 'border-border bg-surface hover:border-primary/30'
                }`}
              >
                <Sun className={`w-8 h-8 ${theme === 'light' ? 'text-indigo-500' : 'text-muted'}`} />
                <span className="font-medium text-primary">Light</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all ${
                  theme === 'dark' 
                    ? 'border-indigo-500 bg-indigo-500/10' 
                    : 'border-border bg-surface hover:border-primary/30'
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
                  className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-primary focus:outline-none focus:border-indigo-500 transition-colors"
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
                    className="w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-3 text-primary focus:outline-none focus:border-indigo-500 transition-colors"
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
                    className="w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-3 text-primary focus:outline-none focus:border-indigo-500 transition-colors"
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
              <p className="text-muted">BrainDump now uses Google Sheets as the source of truth.</p>
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
                  className="w-full bg-surface border border-border rounded-xl pl-4 pr-12 py-4 text-primary focus:outline-none focus:border-indigo-500 transition-colors shadow-sm"
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
                  className="bg-surface-elevated border border-border rounded-xl p-4 text-left"
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
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-4 sm:p-8 lg:p-10">
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-surface">
        <div 
          className="h-full bg-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="hidden lg:block absolute left-10 top-1/2 w-64 -translate-y-1/2 rounded-3xl border border-border bg-surface/70 p-4 shadow-2xl shadow-black/5 backdrop-blur-xl">
        <div className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-muted">Setup path</div>
        <div className="space-y-2">
          {STEPS.map((step, i) => (
            <div
              key={step.id}
              className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${i === currentStep ? 'bg-primary text-background' : 'text-muted'}`}
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i === currentStep ? 'bg-background/15' : i < currentStep ? 'bg-emerald-500/15 text-emerald-500' : 'bg-background text-muted'}`}>
                {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span>
                <span className="block text-sm font-bold">{step.title}</span>
                <span className={`block text-xs ${i === currentStep ? 'text-background/70' : 'text-muted/80'}`}>{i < currentStep ? 'Done' : i === currentStep ? 'Now' : 'Next'}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full max-w-2xl lg:max-w-5xl flex-1 flex flex-col justify-center min-h-[400px]">
        <AnimatePresence mode="wait">
          <div key={currentStep} className="w-full">
            {renderStep()}
          </div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="w-full max-w-md lg:max-w-5xl flex items-center justify-between mt-8 pt-8 border-t border-border">
        <button
          onClick={handleBack}
          className={`px-6 py-3 font-medium rounded-xl transition-colors ${
            currentStep === 0 
              ? 'opacity-0 pointer-events-none' 
              : 'text-muted hover:bg-surface-elevated'
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
          className="px-6 py-3 bg-indigo-500 text-white font-medium rounded-xl hover:bg-indigo-600 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20"
        >
          {currentStep === STEPS.length - 1 ? (
            <>Get Started <Check className="w-5 h-5" /></>
          ) : (
            <>Next <ArrowRight className="w-5 h-5" /></>
          )}
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
