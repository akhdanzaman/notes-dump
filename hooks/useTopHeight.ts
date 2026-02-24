import { useEffect, useRef, useState } from 'react';

export const useTopHeight = (setHeight: (h: number) => void) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateHeight = () => {
            if (ref.current) {
                setHeight(ref.current.offsetHeight);
            }
        };

        // Initial measurement
        updateHeight();

        // Resize observer
        const observer = new ResizeObserver(updateHeight);
        if (ref.current) {
            observer.observe(ref.current);
        }

        return () => observer.disconnect();
    }, [setHeight]);

    return ref;
};
