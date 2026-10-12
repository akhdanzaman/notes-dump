import type React from 'react';
import type { Tab } from '../types';
/** Main navigation uses explicit controls; swipes are reserved for date toolbars. */
export const useSwipeTabs = (_activeTab: Tab, _setActiveTab: (tab: Tab) => void) => {
 const ignore = (_event?: React.TouchEvent) => {};
 return { onTouchStart: ignore, onTouchMove: ignore, onTouchEnd: ignore, dragOffset: 0, isDragging: false, style: { transform: 'none', transition: 'none', touchAction: 'pan-y' } };
};
