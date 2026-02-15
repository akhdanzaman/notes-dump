
import React from 'react';
import { Brain, RefreshCw, CloudCheck, CloudOff, Save, Settings, AlertTriangle } from 'lucide-react';
import { SyncStatus } from '../types';

interface HeaderProps {
    pendingCount: number;
    syncStatus: SyncStatus;
    onSyncClick: () => void;
    onRefreshClick?: () => void;
    onSettingsClick: () => void;
    error: string | null;
}

const Header: React.FC<HeaderProps> = ({ pendingCount, syncStatus, onSyncClick, onRefreshClick, onSettingsClick, error }) => {
    
    const renderSyncIndicator = () => {
        let icon, text, color, onClick;
        switch(syncStatus) {
            case 'synced': 
                icon = <CloudCheck className="w-4 h-4" />; 
                text = "Saved"; 
                color = "text-emerald-400 bg-emerald-400/10 border-emerald-400/20 hover:bg-emerald-400/20 cursor-pointer"; 
                onClick = onRefreshClick;
                break;
            case 'syncing': 
                icon = <RefreshCw className="w-4 h-4 animate-spin" />; 
                text = "Saving..."; 
                color = "text-blue-400 bg-blue-400/10 border-blue-400/20 cursor-wait"; 
                onClick = undefined;
                break;
            case 'error': 
                icon = <CloudOff className="w-4 h-4" />; 
                text = "Sync Failed"; 
                color = "text-red-400 bg-red-400/10 border-red-400/20 hover:bg-red-400/20 cursor-pointer"; 
                onClick = onSyncClick;
                break;
            case 'local': 
                icon = <Save className="w-4 h-4" />; 
                text = "Local"; 
                color = "text-amber-400 bg-amber-400/10 border-amber-400/20 hover:bg-amber-400/20 cursor-pointer"; 
                onClick = onSyncClick;
                break;
        }
        return (
            <button 
                onClick={onClick}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${color}`}
                title={syncStatus === 'synced' ? "Click to refresh from Cloud" : (syncStatus === 'error' ? "Click to Retry Sync" : "Click to Sync")}
            >
                {icon} <span className="hidden sm:inline">{text}</span>
            </button>
        );
    };

    return (
        <>
            <header className="fixed top-0 w-full bg-background/80 backdrop-blur-md z-40 border-b border-border">
                <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-gradient-to-tr from-acc-todo to-acc-event p-2 rounded-lg">
                    <Brain className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight hidden sm:block text-primary">BrainDump <span className="text-muted font-normal text-sm ml-1">AI</span></h1>
                </div>
                
                <div className="flex items-center gap-2">
                    {pendingCount > 0 && (
                        <div className="flex items-center gap-2 text-xs text-acc-todo bg-acc-todo/10 px-3 py-1.5 rounded-full animate-pulse mr-1">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span className="hidden sm:inline">Processing...</span>
                        </div>
                    )}
                    {renderSyncIndicator()}
                    <div className="w-px h-6 bg-border mx-1"></div>
                    <button onClick={onSettingsClick} className="p-2 text-muted hover:text-primary hover:bg-surface rounded-full transition-colors"><Settings className="w-5 h-5" /></button>
                </div>
                </div>
            </header>

            {error && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 max-w-xl w-full px-4 z-30">
                 <div className="p-4 rounded-xl bg-red-900/20 border border-red-900/50 flex items-center gap-3 text-red-800 dark:text-red-200">
                    <AlertTriangle className="w-5 h-5" />
                    <p>{error}</p>
                 </div>
            </div>
            )}
        </>
    );
};

export default Header;
