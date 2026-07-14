export type UiNoticeTone = 'success' | 'error' | 'info';

export interface UiNoticeDetail {
  message: string;
  tone?: UiNoticeTone;
}

export interface UiConfirmationOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
}

export const UI_NOTICE_EVENT = 'arkaiv:ui-notice';
export const UI_CONFIRM_EVENT = 'arkaiv:ui-confirm';

export const notifyUser = (message: string, tone: UiNoticeTone = 'info') => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<UiNoticeDetail>(UI_NOTICE_EVENT, {
    detail: { message, tone },
  }));
};

export const requestUserConfirmation = (options: UiConfirmationOptions): Promise<boolean> => {
  if (typeof window === 'undefined') return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent(UI_CONFIRM_EVENT, {
      detail: { options, resolve },
    }));
  });
};
