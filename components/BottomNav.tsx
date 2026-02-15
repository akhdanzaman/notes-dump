
import React from 'react';
import { LayoutDashboard, Target, ShoppingCart, StickyNote, Wallet as WalletIcon } from 'lucide-react';
import { Tab } from '../types';

interface BottomNavProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
    return (
        <div className="w-full bg-background/95 backdrop-blur-sm border-t border-border pb-safe">
          <div className="max-w-2xl mx-auto grid grid-cols-5 w-full">
            <button onClick={() => setActiveTab('summary')} className={`flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-medium transition-colors ${activeTab === 'summary' ? 'text-primary' : 'text-muted hover:text-primary'}`}>
              <div className={`p-1.5 rounded-full ${activeTab === 'summary' ? 'bg-primary/10' : ''}`}><LayoutDashboard className="w-5 h-5" /></div>
              Summary
            </button>
            <button onClick={() => setActiveTab('focus')} className={`flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-medium transition-colors ${activeTab === 'focus' ? 'text-primary' : 'text-muted hover:text-primary'}`}>
              <div className={`p-1.5 rounded-full ${activeTab === 'focus' ? 'bg-primary/10' : ''}`}><Target className="w-5 h-5" /></div>
              Focus
            </button>
            <button onClick={() => setActiveTab('shopping')} className={`flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-medium transition-colors ${activeTab === 'shopping' ? 'text-primary' : 'text-muted hover:text-primary'}`}>
               <div className={`p-1.5 rounded-full ${activeTab === 'shopping' ? 'bg-primary/10' : ''}`}><ShoppingCart className="w-5 h-5" /></div>
              Life
            </button>
            <button onClick={() => setActiveTab('notes')} className={`flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-medium transition-colors ${activeTab === 'notes' ? 'text-primary' : 'text-muted hover:text-primary'}`}>
               <div className={`p-1.5 rounded-full ${activeTab === 'notes' ? 'bg-primary/10' : ''}`}><StickyNote className="w-5 h-5" /></div>
              Notes
            </button>
            <button onClick={() => setActiveTab('money')} className={`flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-medium transition-colors ${activeTab === 'money' ? 'text-primary' : 'text-muted hover:text-primary'}`}>
               <div className={`p-1.5 rounded-full ${activeTab === 'money' ? 'bg-primary/10' : ''}`}><WalletIcon className="w-5 h-5" /></div>
              Money
            </button>
          </div>
        </div>
    );
};

export default BottomNav;
