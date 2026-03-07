
import React from 'react';
import { LayoutDashboard, Target, ShoppingCart, StickyNote, Wallet as WalletIcon, Menu } from 'lucide-react';
import { Tab } from '../types';

interface BottomNavProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    onMenuClick: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, onMenuClick }) => {
    const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
        { id: 'summary', icon: LayoutDashboard, label: 'Home' },
        { id: 'focus', icon: Target, label: 'Focus' },
        { id: 'shopping', icon: ShoppingCart, label: 'Life' },
        { id: 'notes', icon: StickyNote, label: 'Notes' },
        { id: 'money', icon: WalletIcon, label: 'Money' },
    ];

    return (
        <div className="w-full pb-6 px-4 z-40">
          <div className="max-w-md mx-auto flex items-center justify-between bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-[40px] p-2 shadow-2xl border border-black/5 dark:border-white/10">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)} 
                        className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 ${isActive ? 'bg-black dark:bg-white text-white dark:text-black scale-110 shadow-lg' : 'text-black/40 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10'}`}
                    >
                        <Icon className="w-5 h-5" />
                    </button>
                );
            })}
            
            <div className="w-px h-6 bg-black/10 dark:bg-white/10 mx-1" />

            <button 
                onClick={onMenuClick} 
                className="flex items-center justify-center w-12 h-12 rounded-full text-black/40 dark:text-white/60 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-300"
            >
                <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
    );
};

export default BottomNav;
