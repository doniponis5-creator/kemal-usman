import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { haptic } from '../utils/haptics';
import { IS_NATIVE } from '../utils/platform';
import { iosSpring } from './MotionScreen';

/**
 * BottomSheet — the ONE iOS sheet primitive for the whole app.
 *
 * Grabber + blurred dim backdrop + spring slide-up + drag-to-dismiss +
 * proper exit animation + safe-area padding. Renders through a portal so
 * callers never worry about stacking contexts.
 *
 * Props:
 *   open, onClose   — controlled visibility
 *   dragMode        — 'sheet' (default: whole sheet drags — for short content)
 *                     'handle' (only the grabber drags — REQUIRED when the
 *                     body scrolls, otherwise drag eats scroll gestures)
 *   sheetStyle      — extra styles merged onto the sheet container
 *   zIndex          — overlay z-index (default 9990)
 *   label           — aria-label for the dialog
 *
 * Native gets the Liquid Glass material; web stays the plain solid surface
 * (web build must not change — project rule).
 */
const DISMISS_OFFSET = 120;    // drag past this → dismiss
const DISMISS_VELOCITY = 500;  // px/s flick → dismiss

export function BottomSheet({ open, onClose, children, dragMode = 'sheet', sheetStyle, zIndex = 9990, label }) {
  const dragControls = useDragControls();

  // Escape closes — desktop/web nicety, harmless on touch.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const material = IS_NATIVE
    ? {
        background: 'var(--ku-glass-thick, rgba(255,255,255,0.92))',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderTop: '0.5px solid rgba(255,255,255,0.5)',
      }
    : { background: 'var(--ku-surface, #FFFFFF)' };

  const body = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="bs-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={iosSpring.smooth}
            drag="y"
            dragListener={dragMode === 'sheet'}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.85 }}
            onDragEnd={(e, info) => {
              if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) {
                haptic('light');
                onClose?.();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              ...material,
              borderRadius: '24px 24px 0 0',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              display: 'flex', flexDirection: 'column',
              ...(sheetStyle || {}),
            }}
          >
            {/* Grabber — in 'handle' mode this strip is the drag surface. */}
            <div
              onPointerDown={dragMode === 'handle' ? (e) => dragControls.start(e) : undefined}
              style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px', flexShrink: 0, touchAction: 'none', cursor: 'grab' }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 4, background: 'rgba(120,120,128,0.28)' }} />
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(body, document.body) : body;
}
