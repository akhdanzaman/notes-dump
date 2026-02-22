
import React from 'react';
import { LayoutDashboard, Target, ShoppingCart, StickyNote, Wallet as WalletIcon, Menu } from 'lucide-react';
import { Tab } from '../types';

interface BottomNavProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    onMenuClick: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab, onMenuClick }) => {
    return (
        <div className="w-full bg-background/80 backdrop-blur-xl border-t border-white/10 pb-safe z-40 transition-all duration-300">
          <div className="max-w-2xl mx-auto grid grid-cols-6 w-full px-2">
            <button onClick={() => setActiveTab('summary')} className={`group flex flex-col items-center justify-center py-3 gap-1 transition-all ${activeTab === 'summary' ? 'text-indigo-400' : 'text-muted hover:text-primary'}`}>
              <div className={`p-1.5 rounded-2xl transition-all duration-300 ${activeTab === 'summary' ? 'bg-indigo-500/20 scale-110' : 'group-hover:bg-white/5'}`}>
                <LayoutDashboard className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium tracking-wide">Home</span>
            </button>
            
            <button onClick={() => setActiveTab('focus')} className={`group flex flex-col items-center justify-center py-3 gap-1 transition-all ${activeTab === 'focus' ? 'text-emerald-400' : 'text-muted hover:text-primary'}`}>
              <div className={`p-1.5 rounded-2xl transition-all duration-300 ${activeTab === 'focus' ? 'bg-emerald-500/20 scale-110' : 'group-hover:bg-white/5'}`}>
                <Target className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium tracking-wide">Focus</span>
            </button>
            
            <button onClick={() => setActiveTab('shopping')} className={`group flex flex-col items-center justify-center py-3 gap-1 transition-all ${activeTab === 'shopping' ? 'text-amber-400' : 'text-muted hover:text-primary'}`}>
               <div className={`p-1.5 rounded-2xl transition-all duration-300 ${activeTab === 'shopping' ? 'bg-amber-500/20 scale-110' : 'group-hover:bg-white/5'}`}>
                 <ShoppingCart className="w-5 h-5" />
               </div>
              <span className="text-[10px] font-medium tracking-wide">Life</span>
            </button>
            
            <button onClick={() => setActiveTab('notes')} className={`group flex flex-col items-center justify-center py-3 gap-1 transition-all ${activeTab === 'notes' ? 'text-blue-400' : 'text-muted hover:text-primary'}`}>
               <div className={`p-1.5 rounded-2xl transition-all duration-300 ${activeTab === 'notes' ? 'bg-blue-500/20 scale-110' : 'group-hover:bg-white/5'}`}>
                 <StickyNote className="w-5 h-5" />
               </div>
              <span className="text-[10px] font-medium tracking-wide">Notes</span>
            </button>
            
            <button onClick={() => setActiveTab('money')} className={`group flex flex-col items-center justify-center py-3 gap-1 transition-all ${activeTab === 'money' ? 'text-rose-400' : 'text-muted hover:text-primary'}`}>
               <div className={`p-1.5 rounded-2xl transition-all duration-300 ${activeTab === 'money' ? 'bg-rose-500/20 scale-110' : 'group-hover:bg-white/5'}`}>
                 <WalletIcon className="w-5 h-5" />
               </div>
              <span className="text-[10px] font-medium tracking-wide">Money</span>
            </button>

            <button onClick={onMenuClick} className="group flex flex-col items-center justify-center py-3 gap-1 text-muted hover:text-primary transition-all">
               <div className="p-1.5 rounded-2xl group-hover:bg-white/5 transition-all duration-300">
                 <Menu className="w-5 h-5" />
               </div>
              <span className="text-[10px] font-medium tracking-wide">Menu</span>
            </button>
          </div>
        </div>
    );
};

export default BottomNav;
