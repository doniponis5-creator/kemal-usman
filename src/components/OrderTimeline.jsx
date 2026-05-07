import React from 'react';
import { motion } from 'framer-motion';

// Premium 5-step order status tracker — Dominos / Uber Eats style.
// Renders a horizontal stepper showing all stages, with:
//  - Filled black circle + checkmark for completed steps
//  - Pulsing ring around the CURRENT step (drives "live" feel)
//  - Empty gray circle for pending steps
//  - Special red-X "cancelled" state
//
// Pure presentational — give it a status string, get a beautifully
// animated tracker. Status keys: new | confirmed | preparing | delivering
//                                | delivered | cancelled

const STEPS_RU = [
  { key: 'new', label: 'Новый' },
  { key: 'confirmed', label: 'Подтв.' },
  { key: 'preparing', label: 'Готов.' },
  { key: 'delivering', label: 'Достав.' },
  { key: 'delivered', label: 'Готово' },
];

const STEPS_KG = [
  { key: 'new', label: 'Жаңы' },
  { key: 'confirmed', label: 'Раст.' },
  { key: 'preparing', label: 'Даяр.' },
  { key: 'delivering', label: 'Жетк.' },
  { key: 'delivered', label: 'Бүттү' },
];

export function OrderTimeline({ status, lang = 'ru' }) {
  // ── Cancelled state ──────────────────────────────────────────────────────
  if (status === 'cancelled') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: 'rgba(229,57,53,0.08)',
          borderRadius: 12,
        }}
      >
        <div style={{
          width: 24, height: 24, borderRadius: 12,
          background: '#E53935', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <span style={{ color: '#E53935', fontSize: 13, fontWeight: 700 }}>
          {lang === 'kg' ? 'Жокко чыгарылды' : 'Заказ отменён'}
        </span>
      </motion.div>
    );
  }

  const STEPS = lang === 'kg' ? STEPS_KG : STEPS_RU;
  const currentIdx = Math.max(0, STEPS.findIndex((s) => s.key === status));

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      position: 'relative',
      padding: '4px 4px 0',
    }}>
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isPending = idx > currentIdx;

        return (
          <div
            key={step.key}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              zIndex: 2,
            }}
          >
            {/* Connecting line — animated fill from prev step */}
            {idx > 0 && (
              <div style={{
                position: 'absolute',
                left: 'calc(-50% + 12px)',
                right: 'calc(50% + 12px)',
                top: 11,
                height: 2,
                background: '#E5E5E5',
                zIndex: 1,
                overflow: 'hidden',
              }}>
                <motion.div
                  initial={false}
                  animate={{ width: idx <= currentIdx ? '100%' : '0%' }}
                  transition={{ duration: 0.5, delay: 0.15, ease: [0.32, 0.72, 0, 1] }}
                  style={{ height: 2, background: '#111' }}
                />
              </div>
            )}

            {/* Circle */}
            <motion.div
              initial={false}
              animate={{
                background: (isCompleted || isCurrent) ? '#111' : 'transparent',
                borderColor: isPending ? '#E5E5E5' : '#111',
                scale: isCurrent ? 1.12 : 1,
              }}
              transition={{ type: 'spring', stiffness: 360, damping: 24 }}
              style={{
                width: 24, height: 24, borderRadius: 12,
                border: '2px solid',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                zIndex: 2,
                boxSizing: 'border-box',
              }}
            >
              {isCompleted && (
                <motion.svg
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.25, type: 'spring', stiffness: 400, damping: 24 }}
                  width="12" height="12" viewBox="0 0 24 24"
                  fill="none" stroke="#fff" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </motion.svg>
              )}
              {isCurrent && (
                <>
                  <motion.div
                    animate={{ scale: [1, 2, 2], opacity: [0.55, 0, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                    style={{
                      position: 'absolute',
                      inset: -2,
                      borderRadius: '50%',
                      border: '2px solid #111',
                      pointerEvents: 'none',
                    }}
                  />
                  <div style={{
                    width: 8, height: 8, borderRadius: 4, background: '#fff',
                  }} />
                </>
              )}
            </motion.div>

            {/* Label */}
            <div style={{
              fontSize: 9.5,
              marginTop: 6,
              color: isPending ? '#bbb' : isCurrent ? '#111' : '#666',
              fontWeight: isCurrent ? 700 : 500,
              textAlign: 'center',
              maxWidth: 60,
              lineHeight: 1.25,
              letterSpacing: 0.1,
            }}>
              {step.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
