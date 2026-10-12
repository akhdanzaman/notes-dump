import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from 'motion/react';
import {
  backdropVariants,
  formModalVariants,
  modalVariants,
  reducedBackdropVariants,
  reducedModalVariants,
  sheetVariants,
} from './variants';

type PresencePanelPresentation = 'modal' | 'sheet' | 'form';

type DataAttributes = {
  [key: `data-${string}`]: string | number | boolean | undefined;
};

interface PresencePanelProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  overlayClassName: string;
  panelClassName: string;
  presentation?: PresencePanelPresentation;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  ariaLabel?: string;
  protectDraft?: boolean;
  hasDraft?: boolean;
  onDiscardDraft?: () => void;
  onDraftChange?: () => void;
  draftKey?: string;
  saving?: boolean;
  saveError?: string;
  overlayProps?: Omit<
    HTMLMotionProps<'div'>,
    'children' | 'className' | 'initial' | 'animate' | 'exit' | 'variants'
  > &
    DataAttributes;
  panelProps?: Omit<
    HTMLMotionProps<'div'>,
    'children' | 'className' | 'initial' | 'animate' | 'exit' | 'variants'
  > &
    DataAttributes;
}

let openPanels = 0;
const panelStack: HTMLElement[] = [];
let originalOverflow = '';
let originalInert = false;

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const PresencePanel: React.FC<PresencePanelProps> = ({
  isOpen,
  onClose,
  children,
  overlayClassName,
  panelClassName,
  presentation = 'modal',
  closeOnBackdrop = true,
  closeOnEscape = true,
  ariaLabel,
  protectDraft = presentation === 'form', hasDraft = false, onDiscardDraft, onDraftChange, draftKey, saving = false, saveError,
  overlayProps,
  panelProps,
}) => {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const dirtyRef = useRef(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const requestClose = () => {
    if (saving || panelRef.current?.querySelector('[data-editor-saving="true"]')) return;
    if (protectDraft && (hasDraft || dirtyRef.current || panelRef.current?.querySelector('[data-editor-dirty="true"]'))) setConfirmClose(true); else onClose();
  };
  const closeRef = useRef(requestClose); closeRef.current = requestClose;
  useEffect(() => { if (!isOpen) return; const back = (event: Event) => { if (panelRef.current === panelStack.at(-1)) { event.preventDefault(); closeRef.current(); } }; window.addEventListener("arkaiv-panel-back", back); return () => window.removeEventListener("arkaiv-panel-back", back); }, [isOpen]);
  useLayoutEffect(() => { if (panelRef.current) panelRef.current.style.visibility = isOpen ? 'visible' : 'hidden'; }, [isOpen]);
  const markDirty = () => { dirtyRef.current = true; onDraftChange?.(); };

  useEffect(() => {
    if (!isOpen) { dirtyRef.current = false; setConfirmClose(false); }
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousPanel = panelStack.at(-1); const previousPanelInert = previousPanel?.inert;
    if (previousPanel) previousPanel.inert = true;
    const currentPanel = panelRef.current; if (currentPanel) panelStack.push(currentPanel);
    if (openPanels++ === 0) { originalOverflow = document.body.style.overflow; originalInert = Boolean(document.getElementById('root')?.inert); }
    document.body.style.overflow = 'hidden';
    const root = document.getElementById('root');
    if (root) root.inert = true;
    const resize = () => panelRef.current?.style.setProperty('--editor-viewport-height', `${window.visualViewport?.height || window.innerHeight}px`);
    resize(); window.visualViewport?.addEventListener('resize', resize);
    return () => { if (currentPanel) { const index = panelStack.indexOf(currentPanel); if (index >= 0) panelStack.splice(index, 1); } if (previousPanel) previousPanel.inert = Boolean(previousPanelInert); if (--openPanels === 0) { document.body.style.overflow = originalOverflow; if (root) root.inert = originalInert; } window.visualViewport?.removeEventListener('resize', resize); };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      restoreFocusRef.current ||= document.activeElement instanceof HTMLElement ? document.activeElement : null;
      wasOpenRef.current = true;

      const frame = window.requestAnimationFrame(() => {
        const panel = panelRef.current;
        if (!panel || panel.contains(document.activeElement)) return;
        panel.querySelector<HTMLElement>(focusableSelector)?.focus();
      });

      return () => window.cancelAnimationFrame(frame);
    }

    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      const frame = window.requestAnimationFrame(() => {
        const restoreTarget = restoreFocusRef.current;
        if (
          restoreTarget?.isConnected &&
          !restoreTarget.hasAttribute('disabled') &&
          restoreTarget.getAttribute('aria-disabled') !== 'true'
        ) {
          restoreTarget.focus({ preventScroll: true });
        } else {
          document.querySelector<HTMLElement>('[data-app-main="true"]')?.focus({
            preventScroll: true,
          });
        }
        restoreFocusRef.current = null;
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [isOpen]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (panelRef.current !== panelStack.at(-1)) return;
    if (event.key === 'Escape' && closeOnEscape) {
      event.preventDefault();
      event.stopPropagation();
      requestClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((element) => !element.hasAttribute('disabled') && !element.closest('[inert]') && element.offsetParent !== null);
    if (!focusable.length) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  useEffect(() => { if (confirmClose) panelRef.current?.querySelector<HTMLElement>('[role=alertdialog] button')?.focus(); }, [confirmClose]);

  const panelVariants: Variants = reduceMotion
    ? reducedModalVariants
    : presentation === 'sheet'
      ? sheetVariants
      : presentation === 'form'
        ? formModalVariants
        : modalVariants;

  const panel = (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          {...overlayProps}
          data-presence-panel-layer="true"
          className={overlayClassName}
          variants={reduceMotion ? reducedBackdropVariants : backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onMouseDown={(event) => {
            if (closeOnBackdrop && event.target === event.currentTarget) requestClose();
            overlayProps?.onMouseDown?.(event);
          }}
        >
          <motion.div
            {...panelProps}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            tabIndex={-1}
            className={`${panelClassName} ${panelClassName.includes('fixed') ? '' : 'relative'}`}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onKeyDown={handleKeyDown}
            data-editor-draft-key={draftKey}
            onInputCapture={markDirty}
            onChangeCapture={markDirty}
            onClickCapture={(event) => {
              const target = (event.target as HTMLElement).closest('button');
              if (!target) return;
              if (target.hasAttribute('data-editor-close') || /^(Tutup|Close)\b/.test(target.getAttribute('aria-label') || '') || /^(Batal|Cancel)$/.test(target.textContent?.trim() || '')) {
                event.preventDefault(); event.stopPropagation(); requestClose();
              } else if ((target.hasAttribute('aria-pressed') || target.hasAttribute('data-draft-change')) && !target.closest('[role=alertdialog]')) markDirty();
            }}
            onMouseDown={(event) => {
              event.stopPropagation();
              panelProps?.onMouseDown?.(event);
            }}
          >
            <div className="editor-content contents" inert={confirmClose || undefined}>{children}</div>
            {saveError && <p role="alert" className="editor-error">{saveError}</p>}
            {saving && <p role="status" className="editor-save-status">Menyimpan di perangkat…</p>}
            {confirmClose && <div className="editor-discard" role="alertdialog" aria-label="Perubahan belum disimpan">
              <p>Perubahan belum disimpan. Lanjutkan mengedit atau buang draft ini?</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" autoFocus onClick={() => setConfirmClose(false)}>Lanjut edit</button>
                <button type="button" onClick={() => {
                  onDiscardDraft?.();
                  panelRef.current?.querySelectorAll('[data-ui-editor]').forEach(element => element.dispatchEvent(new CustomEvent('arkaiv-discard-editor', { bubbles: true })));
                  dirtyRef.current = false; setConfirmClose(false); onClose();
                }}>Buang perubahan</button>
              </div>
            </div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document === 'undefined' ? panel : createPortal(panel, document.body);
};

export default PresencePanel;
