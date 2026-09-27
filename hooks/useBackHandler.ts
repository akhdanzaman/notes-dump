import { useEffect, useRef } from 'react';
import { BackHandler } from '../utils/backHandler';

/** Register only while active; keep the callback fresh without reordering the back stack. */
export function useBackHandler(active: boolean, onBack: () => boolean) {
  const callback = useRef(onBack);
  callback.current = onBack;
  useEffect(() => active ? BackHandler.register(() => callback.current()) : undefined, [active]);
}
