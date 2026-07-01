import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { haptic } from '../utils/haptics';

// iOS push-navigation modal. Slides IN from the right on mount and OUT to the
// right on dismiss (back button, add-to-cart, or the left-edge swipe-back
// gesture) — one consistent axis, matching UIKit push/pop. Touches starting
// outside the 30px left edge are ignored so the inner image gallery + scroll
// keep working.

const EDGE_ZONE = 30;
const DISMISS_DISTANCE = 100;   // drag past this → dismiss
const DISMISS_VELOCITY = 500;   // px/s flick → dismiss
const EASE = [0.32, 0.72, 0, 1];

export const EdgeSwipeBack = forwardRef(function EdgeSwipeBack({ onDismiss, children, style }, ref) {
  const screenW = typeof window !== 'undefined' ? window.innerWidth : 400;
  const x = useMotionValue(screenW);   // start off-screen right, then slide in
  const startRef = useRef(null);
  const trackingRef = useRef(false);
  const dirRef = useRef(null);

  // Backdrop dims in as the modal arrives; fades out as it leaves.
  const backdropOpacity = useTransform(x, [0, screenW * 0.7], [0.5, 0]);

  // Entry — slide from the right (iOS push).
  useEffect(() => {
    const controls = animate(x, 0, { duration: 0.34, ease: EASE });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exit — slide to the right, then unmount. Shared by every dismiss path.
  const close = () => {
    animate(x, screenW, { duration: 0.26, ease: EASE, onComplete: () => onDismiss?.() });
  };
  useImperativeHandle(ref, () => ({ close }));

  const handleTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    if (t.clientX > EDGE_ZONE) return;   // not in edge zone — let children handle
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
    if (dirRef.current === 'x' && dx > 0) x.set(dx);
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
      close();
    } else {
      animate(x, 0, { type: 'spring', stiffness: 380, damping: 32 });
    }
  };

  return (
    <>
      {/* Dark backdrop revealed behind the sliding modal */}
      <motion.div
        style={{
          position: 'fixed', inset: 0, zIndex: 1001,
          background: '#000',
          opacity: backdropOpacity,
          pointerEvents: 'none',
        }}
      />
      {/* Modal — push in/out on the x axis, drag-tracked for swipe-back */}
      <motion.div
        style={{
          position: 'fixed', inset: 0, zIndex: 1002,
          background: 'var(--ku-surface, #FFFFFF)',
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
});
