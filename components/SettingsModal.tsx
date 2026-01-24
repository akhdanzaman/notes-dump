import React, { useState, useEffect } from 'react';
import { X, Save, Github, WifiOff, CheckCircle2, Sparkles } from 'lucide-react';
import { getGithubConfig, saveGithubConfig, clearGithubConfig, GithubConfig } from '../services/githubService';
import { getGeminiKey, saveGeminiKey } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
  const [config, setConfig] = useState<GithubConfig>({
    token: '',
    owner: '',
    repo: '',
    path: 'db.json'
  });
  const [geminiKey, setGeminiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');

  useEffect(() => {
    if (isOpen) {
      const current = getGithubConfig();
      if (current) {
        setConfig(current);
      }
      setGeminiKey(getGeminiKey());
      setStatus('idle');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    // Save GitHub Config
    if (config.token && config.owner && config.repo) {
        saveGithubConfig(config);
    } else if (config.token || config.owner || config.repo) {
        // If partially filled, warn user? For now just alert if they are trying to save invalid github config
        alert("For GitHub Sync, please fill Token, Owner, and Repo.");
        return;
    }

    // Save Gemini Config
    saveGeminiKey(geminiKey);

    setStatus('saved');
    setTimeout(() => {
        onSave();
    }, 800);
  };

  const handleDisconnect = () => {
      if (window.confirm("Disconnect GitHub? The app will switch to Local Mode.")) {
          clearGithubConfig();
          setConfig({ token: '', owner: '', repo: '', path: 'db.json' });
          // Note: We don't clear Gemini key here as user might want to keep using AI
          onSave();
      }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-xl w-full max-w-md shadow-2xl p-6 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-background rounded-lg border border-border">
                <Github className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white">Settings</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          
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
                <p className="text-[10px] text-muted mt-1">Required for AI classification. Stored locally.</p>
            </div>
          </div>

          <div className="h-px bg-border w-full"></div>

          {/* GitHub Settings Section */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 mb-2">
                 <Github className="w-4 h-4 text-white" />
                 <h4 className="text-sm font-semibold text-white">GitHub Cloud Sync</h4>
             </div>
             
             <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg text-xs text-blue-200 leading-relaxed">
                Sync your brain dump across devices using a private GitHub repository.
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