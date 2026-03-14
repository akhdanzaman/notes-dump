import React from "react";
import {
  LayoutDashboard,
  Target,
  ShoppingCart,
  StickyNote,
  Wallet as WalletIcon,
  Menu,
} from "lucide-react";
import { Tab } from "../types";

interface BottomNavProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onMenuClick: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  onMenuClick,
}) => {
  const tabs: { id: Tab; icon: React.ElementType; label: string }[] = [
    { id: "summary", icon: LayoutDashboard, label: "Home" },
    { id: "focus", icon: Target, label: "Focus" },
    { id: "shopping", icon: ShoppingCart, label: "Life" },
    { id: "notes", icon: StickyNote, label: "Notes" },
    { id: "money", icon: WalletIcon, label: "Money" },
  ];

  return (
    <div className="w-full pb-6 px-4 z-40">
      <div className="flex justify-center">
        <div className="w-fit">
          <div className="flex items-center gap-1.5 rounded-full border border-black/5 bg-stone-100 px-2 py-2 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-800">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "group relative flex shrink-0 items-center overflow-hidden rounded-full",
                    "transition-all duration-300 ease-in-out",
                    "h-10",
                    isActive
                      ? "w-[108px] bg-white text-black shadow-sm dark:bg-zinc-700 dark:text-white"
                      : "w-10 bg-transparent text-black/40 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "flex w-full items-center transition-all duration-300 ease-in-out",
                      isActive ? "justify-center px-3" : "justify-center px-0",
                    ].join(" ")}
                  >
                    <Icon className="h-5 w-5 shrink-0" />

                    <span
                      className={[
                        "overflow-hidden whitespace-nowrap text-sm font-medium leading-none",
                        "transition-all duration-300 ease-in-out",
                        isActive
                          ? "ml-2 max-w-[56px] opacity-100"
                          : "ml-0 max-w-0 opacity-0",
                      ].join(" ")}
                    >
                      {tab.label}
                    </span>
                  </div>
                </button>
              );
            })}

            <div className="mx-1 h-5 w-px shrink-0 bg-black/10 dark:bg-white/10" />

            <button
              onClick={onMenuClick}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-black/40 transition-all duration-300 ease-in-out hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomNav;
