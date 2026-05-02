import React, { createContext, useCallback, useContext, useState } from 'react';

// Replacement for window.confirm(...) — proper bottom-sheet, accessible,
// promise-based. Wrap the app once with <ConfirmProvider>, then anywhere:
//
//   const confirm = useConfirm();
//   if (await confirm({ title: 'Удалить?', destructive: true })) { ... }

const Ctx = createContext(null);

export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null);
  const [resolver, setResolver] = useState(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    setOpts({
      title: 'Подтвердите действие',
      message: '',
      confirmLabel: 'OK',
      cancelLabel: 'Отмена',
      destructive: false,
      ...options,
    });
    setResolver(() => resolve);
  }), []);

  const handle = (value) => {
    resolver?.(value);
    setOpts(null);
    setResolver(null);
  };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {opts && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            zIndex: 10_000, display: 'flex', alignItems: 'flex-end',
            justifyContent: 'center', animation: 'fadeIn .15s ease',
          }}
          onClick={() => handle(false)}
        >
          <style>{`
            @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
            @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
          `}</style>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 460, background: '#fff',
              borderRadius: '20px 20px 0 0', padding: '24px 20px',
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0))',
              animation: 'slideUp .2s cubic-bezier(.32,.72,0,1)',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 700, color: '#111', textAlign: 'center', marginBottom: opts.message ? 8 : 20 }}>
              {opts.title}
            </div>
            {opts.message && (
              <div style={{ fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
                {opts.message}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => handle(false)}
                style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid #eee', background: '#f5f5f5', color: '#666', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                {opts.cancelLabel}
              </button>
              <button
                onClick={() => handle(true)}
                style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: opts.destructive ? '#E53935' : '#111', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                {opts.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
