import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { haptic } from '../utils/haptics';
import { iosSpring, iosEase } from './MotionScreen';

/**
 * OrderSuccessGate — the signature checkout moment.
 *
 * Shows a full-screen check-draw celebration for ~1.6s (success haptic on
 * mount), then crossfades into `children` (the receipt). Keyed by orderId so
 * every order gets its own moment. Self-contained: no parent state changes.
 *
 * Layering: overlay z 9200 sits ABOVE OrderReceipt (z 9100) so the receipt
 * can mount underneath during the crossfade.
 */
export function OrderSuccessGate({ orderId, label, children }) {
  // `doneFor` stores WHICH order finished its moment — so a new orderId
  // automatically restarts the celebration without a reset-setState in effect.
  const [doneFor, setDoneFor] = useState(null);
  const done = doneFor === orderId;

  useEffect(() => {
    haptic('success');
    const t = setTimeout(() => setDoneFor(orderId), 1600);
    return () => clearTimeout(t);
  }, [orderId]);

  return (
    <>
      {done && children}
      <AnimatePresence>
        {!done && (
          <motion.div
            key={`order-success-${orderId}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: iosEase }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9200,
              background: 'var(--ku-glass-thick, rgba(255,255,255,0.92))',
              backdropFilter: 'saturate(160%) blur(22px)',
              WebkitBackdropFilter: 'saturate(160%) blur(22px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 20,
            }}
          >
            {/* Check circle — bouncy pop, then the check draws itself in. */}
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={iosSpring.bouncy}
              style={{
                width: 96, height: 96, borderRadius: 48,
                background: 'var(--ku-accent, #111111)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.18)',
              }}
            >
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden>
                <motion.path
                  d="M4 12.5L9.5 18L20 6.5"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ delay: 0.18, duration: 0.45, ease: iosEase }}
                />
              </svg>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.3, ease: iosEase }}
              style={{
                fontSize: 18, fontWeight: 700, letterSpacing: -0.3,
                color: 'var(--ku-text, #111111)', textAlign: 'center', padding: '0 32px',
              }}
            >
              {label}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
