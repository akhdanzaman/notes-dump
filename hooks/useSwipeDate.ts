import { useRef, TouchEvent } from 'react';
/** Only deliberate horizontal gestures on the date surface change the date. */
export const useSwipeDate = (onPrev: () => void, onNext: () => void) => {
 const start = useRef<{x: number; y: number} | null>(null);
 const end = useRef<{x: number; y: number} | null>(null);
 const onTouchStart = (event: TouchEvent) => { event.stopPropagation(); end.current = null; if ((event.target as HTMLElement).closest('input,textarea,select,button,[role=dialog]')) { start.current = null; return; } start.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; };
 const onTouchMove = (event: TouchEvent) => { event.stopPropagation(); if (start.current) end.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; };
 const onTouchEnd = (event: TouchEvent) => { event.stopPropagation(); const from = start.current, to = end.current; start.current = null; end.current = null; if (!from || !to) return; const dx = to.x - from.x; const dy = to.y - from.y; if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return; if (dx < 0) onNext(); else onPrev(); };
 return { onTouchStart, onTouchMove, onTouchEnd };
};
