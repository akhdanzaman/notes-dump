import React, { useEffect, useRef } from 'react';
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
  overlayProps,
  panelProps,
}) => {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
    if (event.key === 'Escape' && closeOnEscape) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null);
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

  const panelVariants: Variants = reduceMotion
    ? reducedModalVariants
    : presentation === 'sheet'
      ? sheetVariants
      : presentation === 'form'
        ? formModalVariants
        : modalVariants;

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          {...overlayProps}
          className={overlayClassName}
          variants={reduceMotion ? reducedBackdropVariants : backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onMouseDown={(event) => {
            if (closeOnBackdrop && event.target === event.currentTarget) onClose();
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
            className={panelClassName}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onKeyDown={handleKeyDown}
            onMouseDown={(event) => {
              event.stopPropagation();
              panelProps?.onMouseDown?.(event);
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PresencePanel;
