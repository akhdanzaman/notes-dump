
import React, { useState, useEffect } from 'react';
import { X, Save, Github, WifiOff, CheckCircle2, Sparkles, PieChart, Plus, Trash2, AlertCircle, MessageSquare, EyeOff, Layout, Download, Database } from 'lucide-react';
import { getGithubConfig, saveGithubConfig, clearGithubConfig, GithubConfig } from '../services/githubService';
import { getGeminiKey, saveGeminiKey, DEFAULT_PROMPT } from '../services/geminiService';
import { exportToExcel } from '../services/exportService';
import { BudgetConfig, BudgetRule, AppSettings, BrainDumpItem, Skill, Wallet } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newBudgetConfig?: BudgetConfig, newPrompt?: string, newAppSettings?: AppSettings) => void;
  currentBudgetConfig?: BudgetConfig;
  currentPrompt?: string;
  currentAppSettings?: AppSettings;
  // New props for export
  allItems: BrainDumpItem[];
  allSkills: Skill[];
  allWallets: Wallet[];
  monthlyThemes: Record<string, string>;
}

// Preset colors for budget categories
const COLOR_PRESETS = [
    { name: 'Blue', class: 'bg-blue-500' },
    { name: 'Green', class: 'bg-emerald-500' },
    { name: 'Amber', class: 'bg-amber-500' },
    { name: 'Purple', class: 'bg-purple-500' },
    { name: 'Pink', class: 'bg-pink-500' },
    { name: 'Red', class: 'bg-red-500' },
    { name: 'Cyan', class: 'bg-cyan-500' },
    { name: 'Gray', class: 'bg-gray-500' },
];

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, onClose, onSave, 
    currentBudgetConfig, currentPrompt, currentAppSettings,
    allItems, allSkills, allWallets, monthlyThemes
}) => {
  const [config, setConfig] = useState<GithubConfig>({
    token: '',
    owner: '',
    repo: '',
    path: 'db.json'
  });
  const [geminiKey, setGeminiKey] = useState('');
  
  // Budget State
  const [monthlyIncome, setMonthlyIncome] = useState<number>(0);
  const [budgetRules, setBudgetRules] = useState<BudgetRule[]>([]);
  
  // Prompt State
  const [prompt, setPrompt] = useState('');
  const [isDefaultPrompt, setIsDefaultPrompt] = useState(true);

  // App Settings State
  const [defaultCollapsed, setDefaultCollapsed] = useState(false);
  const [hideMoney, setHideMoney] = useState(false);

  const [status, setStatus] = useState<'idle' | 'saved'>('idle');

  useEffect(() => {
    if (isOpen) {
      const current = getGithubConfig();
      if (current) {
        setConfig(current);
      }
      setGeminiKey(getGeminiKey());
      
      // Init Budget
      if (currentBudgetConfig) {
          setMonthlyIncome(currentBudgetConfig.monthlyIncome || 0);
          setBudgetRules(currentBudgetConfig.rules || []);
      } else {
          // Default 50-30-20 if no config exists
          setBudgetRules([
              { id: 'needs', name: 'Needs', percentage: 50, color: 'bg-blue-500' },
              { id: 'wants', name: 'Wants', percentage: 30, color: 'bg-pink-500' },
              { id: 'savings', name: 'Savings', percentage: 20, color: 'bg-emerald-500' },
          ]);
      }

      // Init Prompt
      if (currentPrompt) {
          setPrompt(currentPrompt);
          setIsDefaultPrompt(currentPrompt === DEFAULT_PROMPT);
      } else {
          setPrompt(DEFAULT_PROMPT);
          setIsDefaultPrompt(true);
      }

      // Init App Settings
      if (currentAppSettings) {
          setDefaultCollapsed(currentAppSettings.defaultCollapsed);
          setHideMoney(currentAppSettings.hideMoney);
      } else {
          setDefaultCollapsed(false);
          setHideMoney(false);
      }
      
      setStatus('idle');
    }
  }, [isOpen, currentBudgetConfig, currentPrompt, currentAppSettings]);

  if (!isOpen) return null;

  const handleAddRule = () => {
      setBudgetRules([...budgetRules, { 
          id: `cat-${Date.now()}`, 
          name: 'New Category', 
          percentage: 0, 
          color: 'bg-gray-500' 
      }]);
  };

  const handleRemoveRule = (index: number) => {
      const newRules = [...budgetRules];
      newRules.splice(index, 1);
      setBudgetRules(newRules);
  };

  const handleUpdateRule = (index: number, field: keyof BudgetRule, value: any) => {
      const newRules = [...budgetRules];
      newRules[index] = { ...newRules[index], [field]: value };
      setBudgetRules(newRules);
  };

  const totalPercentage = budgetRules.reduce((sum, r) => sum + r.percentage, 0);

  const handleSave = () => {
    // Save GitHub Config
    if (config.token && config.owner && config.repo) {
        saveGithubConfig(config);
    } else if (config.token || config.owner || config.repo) {
        alert("For GitHub Sync, please fill Token, Owner, and Repo.");
        return;
    }

    // Save Gemini Config
    saveGeminiKey(geminiKey);

    // Prepare Budget Config
    const newBudgetConfig: BudgetConfig = {
        monthlyIncome,
        rules: budgetRules
    };

    // Prepare App Settings
    const newAppSettings: AppSettings = {
        defaultCollapsed,
        hideMoney
    };

    setStatus('saved');
    setTimeout(() => {
        onSave(newBudgetConfig, prompt, newAppSettings);
    }, 800);
  };

  const handleDisconnect = () => {
      if (window.confirm("Disconnect GitHub? The app will switch to Local Mode.")) {
          clearGithubConfig();
          setConfig({ token: '', owner: '', repo: '', path: 'db.json' });
          onSave(undefined); 
      }
  };

  const resetPrompt = () => {
      setPrompt(DEFAULT_PROMPT);
      setIsDefaultPrompt(true);
  };

  const handleExport = () => {
      exportToExcel(
          allItems, 
          allSkills, 
          allWallets, 
          { monthlyIncome, rules: budgetRules }, // Use current state config
          monthlyThemes, 
          { defaultCollapsed, hideMoney } // Use current state settings
      );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl p-6 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white">Settings</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-8">
          
          {/* APPEARANCE & PRIVACY */}
          <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2 border-b border-border pb-2">
                 <Layout className="w-4 h-4 text-primary" />
                 <h4 className="text-sm font-semibold text-white">Appearance & Privacy</h4>
            </div>
            
            <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-background border border-border rounded-lg">
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-white">Default Card State</span>
                        <span className="text-[10px] text-muted">Automatically collapse cards in lists</span>
                    </div>
                    <button 
                        onClick={() => setDefaultCollapsed(!defaultCollapsed)}
                        className={`w-10 h-5 rounded-full relative transition-colors ${defaultCollapsed ? 'bg-indigo-600' : 'bg-white/10'}`}
                    >
                        <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${defaultCollapsed ? 'translate-x-5' : ''}`}></div>
                    </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-background border border-border rounded-lg">
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-white flex items-center gap-1">
                             <EyeOff className="w-3 h-3" /> Hide Nominal Amounts
                        </span>
                        <span className="text-[10px] text-muted">Mask monetary values on cards (Rp •••••)</span>
                    </div>
                    <button 
                        onClick={() => setHideMoney(!hideMoney)}
                        className={`w-10 h-5 rounded-full relative transition-colors ${hideMoney ? 'bg-indigo-600' : 'bg-white/10'}`}
                    >
                        <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform ${hideMoney ? 'translate-x-5' : ''}`}></div>
                    </button>
                </div>
            </div>
          </div>
          
          <div className="h-px bg-border w-full"></div>

          {/* BUDGET SETTINGS */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2 border-b border-border pb-2">
                 <PieChart className="w-4 h-4 text-acc-shopping" />
                 <h4 className="text-sm font-semibold text-white">Budget & Income</h4>
            </div>
            
            <div>
                <label className="block text-xs font-medium text-muted mb-1">Monthly Income (IDR)</label>
                <input
                  type="number"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-acc-shopping transition-colors"
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 10000000"
                />
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center">
                     <label className="block text-xs font-medium text-muted">Categories & Limits</label>
                     <span className={`text-xs font-bold ${totalPercentage === 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        Total: {totalPercentage}%
                     </span>
                </div>
                
                {budgetRules.map((rule, idx) => (
                    <div key={rule.id} className="flex items-center gap-2 p-2 bg-background rounded-lg border border-border">
                        {/* Color Picker (Simple) */}
                        <div className="dropdown relative group/color">
                            <div className={`w-6 h-6 rounded-full cursor-pointer ${rule.color} border border-white/20`}></div>
                            <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-lg p-2 grid grid-cols-4 gap-1 shadow-xl hidden group-hover/color:grid z-10 w-32">
                                {COLOR_PRESETS.map(c => (
                                    <button 
                                        key={c.name} 
                                        onClick={() => handleUpdateRule(idx, 'color', c.class)}
                                        className={`w-5 h-5 rounded-full ${c.class} hover:scale-110 transition-transform`}
                                        title={c.name}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Name */}
                        <input 
                            type="text" 
                            value={rule.name}
                            onChange={(e) => handleUpdateRule(idx, 'name', e.target.value)}
                            className="flex-1 bg-transparent text-xs text-white focus:outline-none border-b border-transparent focus:border-muted"
                            placeholder="Category Name"
                        />

                        {/* Percentage */}
                        <div className="flex items-center gap-1">
                            <input 
                                type="number" 
                                value={rule.percentage}
                                onChange={(e) => handleUpdateRule(idx, 'percentage', parseFloat(e.target.value) || 0)}
                                className="w-12 bg-black/20 text-xs text-right text-white rounded p-1 focus:outline-none"
                            />
                            <span className="text-xs text-muted">%</span>
                        </div>

                        {/* Delete */}
                        <button onClick={() => handleRemoveRule(idx)} className="text-muted hover:text-red-400">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                
                <button onClick={handleAddRule} className="w-full py-2 border border-dashed border-border rounded-lg text-xs text-muted hover:text-white hover:border-muted flex items-center justify-center gap-1 transition-colors">
                    <Plus className="w-3 h-3" /> Add Category
                </button>

                {totalPercentage !== 100 && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 p-2 rounded">
                        <AlertCircle className="w-3 h-3" />
                        <span>Total percentage should equal 100%.</span>
                    </div>
                )}
            </div>
          </div>

          <div className="h-px bg-border w-full"></div>

          {/* AI Settings Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                 <Sparkles className="w-4 h-4 text-acc-note" />
                 <h4 className="text-sm font-semibold text-white">Gemini AI Configuration</h4>
            </div>
            <div>
                <label className="block text-xs font-medium text-muted mb-1">Google Gemini API Key</label>
                <input
                  type="password"
                  className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-acc-note transition-colors placeholder:text-muted/20"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                />
            </div>

            <div className="pt-2">
                 <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-muted flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> System Prompt
                    </label>
                    <button 
                        onClick={resetPrompt}
                        className="text-[10px] text-acc-todo hover:underline disabled:opacity-50"
                        disabled={prompt === DEFAULT_PROMPT}
                    >
                        Reset to Default
                    </button>
                 </div>
                 <textarea
                    className="w-full bg-black/30 border border-border rounded-lg p-3 text-xs text-gray-300 focus:outline-none focus:border-acc-note h-32 resize-y"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter custom prompt instructions for categorization..."
                 />
                 <p className="text-[10px] text-muted mt-1">
                    Edit this to customize how the AI categorizes your inputs.
                 </p>
            </div>
          </div>

          <div className="h-px bg-border w-full"></div>

          {/* Data Management Section */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 mb-2">
                 <Database className="w-4 h-4 text-white" />
                 <h4 className="text-sm font-semibold text-white">Data Management</h4>
             </div>
             
             <div className="flex items-center justify-between p-3 bg-background border border-border rounded-lg">
                <div className="flex flex-col">
                    <span className="text-xs font-medium text-white">Export Data</span>
                    <span className="text-[10px] text-muted">Download all data as Excel (.xlsx)</span>
                </div>
                <button 
                    onClick={handleExport}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors"
                >
                    <Download className="w-3.5 h-3.5" /> Export
                </button>
             </div>
          </div>

          <div className="h-px bg-border w-full"></div>

          {/* GitHub Settings Section */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 mb-2">
                 <Github className="w-4 h-4 text-white" />
                 <h4 className="text-sm font-semibold text-white">GitHub Cloud Sync</h4>
             </div>
             
             <div>
                <label className="block text-xs font-medium text-muted mb-1">GitHub Personal Access Token</label>
                <input
                type="password"
                className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-acc-todo transition-colors placeholder:text-muted/20"
                value={config.token}
                onChange={(e) => setConfig({ ...config, token: e.target.value })}
                placeholder="ghp_xxxxxxxxxxxx"
                />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-muted mb-1">Owner (User/Org)</label>
                    <input
                    type="text"
                    className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-acc-todo transition-colors"
                    value={config.owner}
                    onChange={(e) => setConfig({ ...config, owner: e.target.value })}
                    placeholder="username"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-muted mb-1">Repository</label>
                    <input
                    type="text"
                    className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-acc-todo transition-colors"
                    value={config.repo}
                    onChange={(e) => setConfig({ ...config, repo: e.target.value })}
                    placeholder="my-notes"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-muted mb-1">File Path</label>
                <input
                type="text"
                className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-acc-todo transition-colors"
                value={config.path}
                onChange={(e) => setConfig({ ...config, path: e.target.value })}
                placeholder="db.json"
                />
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-between items-center">
            {config.token ? (
                 <button 
                 onClick={handleDisconnect}
                 className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 hover:bg-red-400/10 rounded"
               >
                 <WifiOff className="w-3 h-3" /> Disconnect GitHub
               </button>
            ) : (
                <div></div>
            )}
         
          <div className="flex gap-2">
            <button 
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-muted hover:text-white transition-colors"
            >
                Cancel
            </button>
            <button 
                onClick={handleSave}
                disabled={status === 'saved'}
                className={`px-6 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-lg ${
                    status === 'saved' 
                    ? 'bg-green-500 text-white' 
                    : 'bg-primary text-background hover:bg-white'
                }`}
            >
                {status === 'saved' ? (
                    <>
                        <CheckCircle2 className="w-4 h-4" /> Saved
                    </>
                ) : (
                    <>
                        <Save className="w-4 h-4" /> Save Settings
                    </>
                )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
