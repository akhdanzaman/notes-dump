
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
                icon = <CloudCheck className="w-5 h-5" />; 
                text = "Saved"; 
                color = "text-emerald-500 bg-emerald-500/10"; 
                onClick = onRefreshClick;
                break;
            case 'syncing': 
                icon = <RefreshCw className="w-5 h-5 animate-spin" />; 
                text = "Saving..."; 
                color = "text-blue-500 bg-blue-500/10"; 
                onClick = undefined;
                break;
            case 'error': 
                icon = <CloudOff className="w-5 h-5" />; 
                text = "Failed"; 
                color = "text-red-500 bg-red-500/10"; 
                onClick = onSyncClick;
                break;
            case 'local': 
                icon = <Save className="w-5 h-5" />; 
                text = "Local"; 
                color = "text-amber-500 bg-amber-500/10"; 
                onClick = onSyncClick;
                break;
        }
        return (
            <button 
                onClick={onClick}
                className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${color}`}
                title={syncStatus === 'synced' ? "Click to refresh" : (syncStatus === 'error' ? "Retry Sync" : "Sync Status")}
            >
                {icon}
            </button>
        );
    };

    return (
        <>
            <header className="fixed top-0 w-full bg-background/80 backdrop-blur-xl z-40 transition-all duration-300">
                <div className="max-w-2xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex flex-col justify-center">
                        <span className="text-xs font-semibold text-muted uppercase tracking-wider mb-0.5">My Assistant</span>
                        <h1 className="text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
                            BrainDump <span className="text-indigo-500">AI</span>
                        </h1>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {pendingCount > 0 && (
                            <div className="flex items-center gap-2 text-xs text-blue-500 bg-blue-500/10 px-3 py-1.5 rounded-full animate-pulse">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span className="hidden sm:inline font-medium">Processing...</span>
                            </div>
                        )}
                        
                        {renderSyncIndicator()}
                        
                        <button 
                            onClick={onSettingsClick} 
                            className="w-10 h-10 flex items-center justify-center text-primary bg-surface hover:bg-muted/10 rounded-full transition-colors"
                        >
                            <Settings className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </header>

            {error && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 max-w-xl w-[90%] z-30 animate-in slide-in-from-top-4 fade-in duration-300">
                 <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 backdrop-blur-md flex items-start gap-3 text-red-600 dark:text-red-400 shadow-lg">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{error}</p>
                 </div>
            </div>
            )}
        </>
    );
};

export default Header;
