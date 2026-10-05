import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AlertTriangle, X } from 'lucide-react';

export interface ConfirmOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` renders the confirm button in red and is the default for destructive asks. */
  tone?: 'danger' | 'primary';
}

interface PendingConfirm extends ConfirmOptions {
  message: string;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let pending: PendingConfirm | null = null;
let resolver: ((value: boolean) => void) | null = null;

function ConfirmDialog({ request, onSettle }: { request: PendingConfirm; onSettle: (v: boolean) => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSettle(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onSettle]);

  const isDanger = request.tone !== 'primary';

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={() => onSettle(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={request.title || 'ยืนยันการดำเนินการ'}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start gap-3 p-5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDanger ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
            }`}
          >
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-900">{request.title || 'ยืนยันการดำเนินการ'}</h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed whitespace-pre-line">{request.message}</p>
          </div>
          <button
            type="button"
            onClick={() => onSettle(false)}
            aria-label="ปิดหน้าต่าง"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={() => onSettle(false)}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer min-h-[44px]"
          >
            {request.cancelLabel || 'ยกเลิก'}
          </button>
          <button
            type="button"
            ref={confirmRef}
            onClick={() => onSettle(true)}
            className={`px-3.5 py-2 rounded-xl text-white text-xs font-bold cursor-pointer min-h-[44px] ${
              isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {request.confirmLabel || (isDanger ? 'ยืนยัน' : 'ตกลง')}
          </button>
        </div>
      </div>
    </div>
  );
}

function render() {
  if (!container) {
    container = document.createElement('div');
    container.id = 'scrfoil-confirm-root';
    document.body.appendChild(container);
    root = createRoot(container);
  }
  root?.render(pending ? <ConfirmDialog request={pending} onSettle={settle} /> : null);
}

function settle(value: boolean) {
  const r = resolver;
  resolver = null;
  pending = null;
  render();
  r?.(value);
}

/**
 * Replacement for `window.confirm` that renders in-app.
 *
 * Awaits the operator's choice, so call sites must be async:
 *   `if (!(await confirmAction({ message: '...' }))) return;`
 */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  // A second request while one is open resolves the first as "cancelled"
  // rather than leaving its promise dangling forever.
  resolver?.(false);
  return new Promise<boolean>((resolve) => {
    pending = { tone: 'danger', ...options };
    resolver = resolve;
    render();
  });
}

export const ConfirmAction = {
  danger: (message: string, confirmLabel = 'ยืนยัน'): Promise<boolean> =>
    confirmAction({ message, confirmLabel, tone: 'danger' }),
};