import { useRef, TouchEvent } from 'react';

export const useSwipeDate = (onPrev: () => void, onNext: () => void) => {
    const touchStart = useRef<number | null>(null);
    const touchEnd = useRef<number | null>(null);

    // Minimum swipe distance
    const minSwipeDistance = 30;

    const onTouchStart = (e: TouchEvent) => {
        e.stopPropagation(); 
        touchEnd.current = null;
        touchStart.current = e.targetTouches[0].clientX;
    };

    const onTouchMove = (e: TouchEvent) => {
        e.stopPropagation();
        touchEnd.current = e.targetTouches[0].clientX;
    };

    const onTouchEnd = (e: TouchEvent) => {
        e.stopPropagation();
        if (!touchStart.current || !touchEnd.current) return;
        
        const distance = touchStart.current - touchEnd.current;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            onNext();
        }
        if (isRightSwipe) {
            onPrev();
        }
    };

    return { onTouchStart, onTouchMove, onTouchEnd };
};
