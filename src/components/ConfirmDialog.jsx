import { createContext, useCallback, useContext, useState } from 'react';
import { haptic } from '../utils/haptics';
import { BottomSheet } from './BottomSheet';

// Replacement for window.confirm(...) — proper iOS bottom-sheet, accessible,
// promise-based. Built on the shared BottomSheet primitive (spring slide,
// blur backdrop, drag-to-dismiss, exit animation). Public API unchanged:
//
//   const confirm = useConfirm();
//   if (await confirm({ title: 'Удалить?', destructive: true })) { ... }

const Ctx = createContext(null);

export function ConfirmProvider({ children }) {
  // `view` holds the content and intentionally survives closing, so the
  // sheet doesn't blank out during its exit slide. `open` drives visibility.
  const [view, setView] = useState(null);
  const [open, setOpen] = useState(false);
  const [resolver, setResolver] = useState(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    setView({
      title: 'Подтвердите действие',
      message: '',
      confirmLabel: 'OK',
      cancelLabel: 'Отмена',
      destructive: false,
      ...options,
    });
    setOpen(true);
    setResolver(() => resolve);
  }), []);

  const handle = (value) => {
    resolver?.(value);
    setOpen(false);
    setResolver(null);
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <BottomSheet open={open} onClose={() => handle(false)} zIndex={10_000} label={view?.title}>
        {view && (
          <div style={{ padding: '8px 20px 24px' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ku-text, #111111)', textAlign: 'center', marginBottom: view.message ? 8 : 20 }}>
              {view.title}
            </div>
            {view.message && (
              <div style={{ fontSize: 14, color: 'var(--ku-text-2, #666666)', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
                {view.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { haptic('light'); handle(false); }}
                style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid var(--ku-border, #EEEEEE)', background: 'var(--ku-surface-2, #F5F5F5)', color: 'var(--ku-text-2, #666666)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {view.cancelLabel}
              </button>
              <button
                onClick={() => { haptic(view.destructive ? 'medium' : 'light'); handle(true); }}
                style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: view.destructive ? '#E53935' : 'var(--ku-accent, #111111)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {view.confirmLabel}
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
