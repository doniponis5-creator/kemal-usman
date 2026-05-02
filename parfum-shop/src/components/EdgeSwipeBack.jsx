import React, { useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { haptic } from '../utils/haptics';

// iOS-style "swipe from left edge to dismiss" gesture, identical timing curve
// to UIKit's interactivePopGestureRecognizer. Touches starting OUTSIDE the
// 30px edge zone are ignored — that's intentional so other touch handlers
// (image gallery swipe, scroll) inside the modal still work.

const EDGE_ZONE = 30;          // px from left edge that arms the gesture
const DISMISS_DISTANCE = 100;  // drag past this → dismiss
const DISMISS_VELOCITY = 500;  // px/s flick → dismiss

export function EdgeSwipeBack({ onDismiss, children, style }) {
  const x = useMotionValue(0);
  const startRef = useRef(null);
  const trackingRef = useRef(false);
  const dirRef = useRef(null);

  const screenW = typeof window !== 'undefined' ? window.innerWidth : 400;
  // Backdrop fades out as user drags right; modal opacity stays 1.
  const backdropOpacity = useTransform(x, [0, screenW * 0.7], [0.45, 0]);

  const handleTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    if (t.clientX > EDGE_ZONE) return; // not in edge zone — let children handle
    startRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    trackingRef.current = true;
    dirRef.current = null;
  };

  const handleTouchMove = (e) => {
    if (!trackingRef.current) return;
    const t = e.touches?.[0];
    if (!t || !startRef.current) return;
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;
    if (dirRef.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      dirRef.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (dirRef.current === 'x' && dx > 0) {
      x.set(dx);
    }
  };

  const handleTouchEnd = (e) => {
    if (!trackingRef.current || !startRef.current) return;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - startRef.current.x;
    const dt = Math.max(1, Date.now() - startRef.current.t);
    const velocity = (dx / dt) * 1000;
    trackingRef.current = false;

    if (dx > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
      haptic('light');
      animate(x, screenW, {
        duration: 0.22,
        ease: [0.32, 0.72, 0, 1],
        onComplete: () => onDismiss?.(),
      });
    } else {
      animate(x, 0, { type: 'spring', stiffness: 380, damping: 32 });
    }
  };

  return (
    <>
      {/* Dark backdrop fades out as user drags */}
      <motion.div
        style={{
          position: 'fixed', inset: 0, zIndex: 998,
          background: '#000',
          opacity: backdropOpacity,
          pointerEvents: 'none',
        }}
      />
      {/* Modal — slides up on entry, drag-tracked horizontally */}
      <motion.div
        initial={{ y: '100%', opacity: 0.6 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: '#fff',
          display: 'flex', flexDirection: 'column',
          x,
          ...(style || {}),
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {children}
      </motion.div>
    </>
  );
}
