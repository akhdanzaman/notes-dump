import React, { useState, useRef } from 'react';
import { Tab } from '../types';

export const useSwipeTabs = (activeTab: Tab, setActiveTab: (tab: Tab) => void) => {
    const tabs: Tab[] = ['summary', 'focus', 'shopping', 'notes', 'money'];
    const activeIndex = tabs.indexOf(activeTab);

    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartRef = useRef<{ x: number, y: number } | null>(null);
    const isHorizontalSwipe = useRef<boolean | null>(null);

    const onTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setIsDragging(true);
        isHorizontalSwipe.current = null;
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        
        const dx = e.touches[0].clientX - touchStartRef.current.x;
        const dy = e.touches[0].clientY - touchStartRef.current.y;

        if (isHorizontalSwipe.current === null) {
             if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5) {
                 isHorizontalSwipe.current = true;
             } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 5) {
                 isHorizontalSwipe.current = false;
             }
        }

        if (isHorizontalSwipe.current) {
            // Resistance at edges
            if ((activeIndex === 0 && dx > 0) || (activeIndex === tabs.length - 1 && dx < 0)) {
                setDragOffset(dx * 0.3);
            } else {
                setDragOffset(dx);
            }
        }
    };

    const onTouchEnd = () => {
        setIsDragging(false);
        const threshold = window.innerWidth * 0.25;

        if (isHorizontalSwipe.current && Math.abs(dragOffset) > threshold) {
            if (dragOffset < 0 && activeIndex < tabs.length - 1) {
                setActiveTab(tabs[activeIndex + 1]);
            }
            if (dragOffset > 0 && activeIndex > 0) {
                setActiveTab(tabs[activeIndex - 1]);
            }
        }
        
        setDragOffset(0);
        touchStartRef.current = null;
        isHorizontalSwipe.current = null;
    };

    return {
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        dragOffset,
        isDragging,
        style: {
            transform: `translateX(${dragOffset}px)`,
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
            touchAction: 'pan-y'
        }
    };
};
