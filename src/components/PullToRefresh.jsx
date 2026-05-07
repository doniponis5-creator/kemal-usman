import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { haptic } from '../utils/haptics';

// iOS-style pull-to-refresh. Wraps a scrollable area; when user pulls down
// past `threshold` px while at the top, fires `onRefresh()` and shows a
// spinner that rotates with pull progress, then spins continuously while
// the async refresh runs.
//
//   <PullToRefresh onRefresh={async () => { await refetch() }}>
//      ...scrollable content...
//   </PullToRefresh>

const THRESHOLD = 70;     // px to arm refresh
const MAX_PULL = 120;     // hard cap
const RESISTANCE = 0.55;  // damping factor — feels iOS-y

export function PullToRefresh({ onRefresh, children, style }) {
  const containerRef = useRef(null);
  const startY = useRef(null);
  const [refreshing, setRefreshing] = useState(false);
  const pull = useMotionValue(0);
  const armed = useMotionValue(0); // 0..1 — used for indicator opacity/rotation

  // Indicator opacity & rotation derived from pull
  const opacity = useTransform(pull, [0, THRESHOLD * 0.4, THRESHOLD], [0, 0.7, 1]);
  const rotate = useTransform(pull, [0, THRESHOLD], [0, 180]);
  const scale = useTransform(pull, [0, THRESHOLD], [0.7, 1]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let lastArmed = false;

    const handleStart = (e) => {
      if (refreshing) return;
      if (el.scrollTop > 0) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
    };

    const handleMove = (e) => {
      if (startY.current === null || refreshing) return;
      // If user scrolled away from the top, abort.
      if (el.scrollTop > 0) { startY.current = null; pull.set(0); return; }
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { pull.set(0); return; }
      const v = Math.min(dy * RESISTANCE, MAX_PULL);
      pull.set(v);
      const isArmed = v >= THRESHOLD;
      if (isArmed && !lastArmed) haptic('light');
      lastArmed = isArmed;
      armed.set(isArmed ? 1 : 0);
    };

    const handleEnd = async () => {
      if (startY.current === null) return;
      const v = pull.get();
      startY.current = null;
      lastArmed = false;
      if (v >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        haptic('medium');
        // Hold spinner at threshold while refreshing
        pull.set(THRESHOLD);
        try { await onRefresh?.(); } catch { /* ignore */ }
        setRefreshing(false);
      }
      pull.set(0);
      armed.set(0);
    };

    el.addEventListener('touchstart', handleStart, { passive: true });
    el.addEventListener('touchmove', handleMove, { passive: true });
    el.addEventListener('touchend', handleEnd);
    el.addEventListener('touchcancel', handleEnd);

    return () => {
      el.removeEventListener('touchstart', handleStart);
      el.removeEventListener('touchmove', handleMove);
      el.removeEventListener('touchend', handleEnd);
      el.removeEventListener('touchcancel', handleEnd);
    };
  }, [onRefresh, refreshing, pull, armed]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        height: '100%',
        ...style,
      }}
    >
      {/* Spinner indicator — sits above the content, fades in as user pulls. */}
      <motion.div
        style={{
          position: 'absolute',
          top: 'calc(env(safe-area-inset-top, 12px) + 8px)',
          left: '50%',
          x: '-50%',
          width: 36, height: 36,
          borderRadius: 18,
          background: 'rgba(0,0,0,0.85)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 30,
          opacity,
          scale,
          pointerEvents: 'none',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
      >
        {refreshing ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
            style={{
              width: 18, height: 18,
              border: '2px solid rgba(255,255,255,0.25)',
              borderTopColor: '#fff',
              borderRadius: '50%',
            }}
          />
        ) : (
          <motion.svg
            width="18" height="18" viewBox="0 0 24 24"
            fill="none" stroke="#fff" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ rotate }}
          >
            <polyline points="6 9 12 15 18 9" />
          </motion.svg>
        )}
      </motion.div>

      {/* Content — translates down with pull */}
      <motion.div style={{ y: pull }}>{children}</motion.div>
    </div>
  );
}
