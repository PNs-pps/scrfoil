import { useEffect, useRef } from 'react';

/**
 * Shared dialog behaviour for every modal in the app.
 *
 * Wires up the parts that are easy to forget per-component:
 *  - `role="dialog"` / `aria-modal` / labelling on the panel
 *  - Escape closes (unless the modal is busy and forbids it)
 *  - Tab is trapped inside the panel while it is open
 *  - background scroll is locked, and restored on unmount
 *  - focus moves to the panel on open and returns to the trigger on close
 *
 * @param isOpen  whether the modal is currently visible
 * @param onClose close callback (Escape / backdrop)
 * @param label   accessible name for the dialog
 * @param options.closeOnEscape set false while a save is in flight
 * @param options.initialFocusRef element to focus instead of the panel
 */
export function useModalA11y(
  isOpen: boolean,
  onClose: () => void,
  label?: string,
  options: { closeOnEscape?: boolean; initialFocusRef?: React.RefObject<HTMLElement | null> } = {}
) {
  const { closeOnEscape = true, initialFocusRef } = options;
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    restoreFocusRef.current = (document.activeElement as HTMLElement) || null;
    panelRef.current?.setAttribute('role', panelRef.current.getAttribute('role') || 'dialog');
    panelRef.current?.setAttribute('aria-modal', 'true');
    if (label && !panelRef.current?.getAttribute('aria-label')) {
      panelRef.current?.setAttribute('aria-label', label);
    }

    const focusTarget = initialFocusRef?.current || panelRef.current;
    // rAF so focus lands after the browser has laid the dialog out.
    const raf = requestAnimationFrame(() => focusTarget?.focus());

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const getFocusable = () => {
      if (!panelRef.current) return [] as HTMLElement[];
      return Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!closeOnEscape) return;
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        e.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      // Returning focus avoids dumping the operator back at the top of the page.
      const restore = restoreFocusRef.current;
      if (restore && document.body.contains(restore)) {
        restore.focus();
      }
    };
  }, [isOpen, label, closeOnEscape, initialFocusRef]);

  return panelRef;
}