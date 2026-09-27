import { useCallback, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { UI_CONFIRM_EVENT, UI_NOTICE_EVENT, type UiConfirmationOptions, type UiNoticeDetail, type UiNoticeTone } from '../utils/uiFeedback';

export type ShowAppNotice = (message: string, tone?: UiNoticeTone) => void;
type Confirmation = { options: UiConfirmationOptions; resolve: (confirmed: boolean) => void };

export function useAppFeedback() {
  const [appNotice, setAppNotice] = useState<{ id: string; message: string; tone: UiNoticeTone } | null>(null);
  const [globalConfirmation, setGlobalConfirmation] = useState<Confirmation | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<Confirmation | null>(null);
  pending.current = globalConfirmation;
  const showAppNotice = useCallback<ShowAppNotice>((message, tone = 'info') => {
    clearTimeout(timeout.current);
    setAppNotice({ id: uuidv4(), message, tone });
    timeout.current = setTimeout(() => setAppNotice(null), 4500);
  }, []);
  useEffect(() => {
    const onNotice = (event: Event) => {
      const detail = (event as CustomEvent<UiNoticeDetail>).detail;
      if (detail?.message) showAppNotice(detail.message, detail.tone);
    };
    const onConfirm = (event: Event) => {
      const detail = (event as CustomEvent<Confirmation>).detail;
      if (!detail?.options || typeof detail.resolve !== 'function') return;
      pending.current?.resolve(false);
      pending.current = detail;
      setGlobalConfirmation(detail);
    };
    window.addEventListener(UI_NOTICE_EVENT, onNotice);
    window.addEventListener(UI_CONFIRM_EVENT, onConfirm);
    return () => {
      window.removeEventListener(UI_NOTICE_EVENT, onNotice);
      window.removeEventListener(UI_CONFIRM_EVENT, onConfirm);
      clearTimeout(timeout.current);
      pending.current?.resolve(false);
    };
  }, [showAppNotice]);
  return { appNotice, globalConfirmation, setGlobalConfirmation, showAppNotice };
}
