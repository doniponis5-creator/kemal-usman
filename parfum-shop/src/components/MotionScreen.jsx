import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// iOS 26 animation presets — same physics SwiftUI uses for `.snappy`,
// `.smooth`, and `.bouncy`. Use these everywhere instead of ad-hoc curves.
export const iosSpring = {
  snappy: { type: 'spring', stiffness: 420, damping: 32, mass: 0.85 },
  smooth: { type: 'spring', stiffness: 220, damping: 30, mass: 1 },
  bouncy: { type: 'spring', stiffness: 300, damping: 18, mass: 1 },
};

// iOS-canonical cubic-bezier for non-spring transitions (e.g. opacity/blur).
export const iosEase = [0.32, 0.72, 0, 1];

// Premium screen transitions — iOS 26 snappy spring + crossfade lift.
// (No filter:blur — that caused the React content to stay invisible on
// some iOS WKWebView builds, producing a blank white screen.)
const variants = {
  initial: { opacity: 0, y: 12, scale: 0.985 },
  in:      { opacity: 1, y: 0,  scale: 1 },
  out:     { opacity: 0, y: -8, scale: 0.985 },
};

export function MotionScreen({ screenKey, children, className, style }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={screenKey}
        initial="initial"
        animate="in"
        exit="out"
        variants={variants}
        transition={iosSpring.snappy}
        className={className}
        style={{ width: '100%', ...(style || {}) }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Small, opinionated CTA that adds spring-feel tap + light haptic.
// Drop-in replacement for any <button>.
export function MotionButton({ children, onClick, style, disabled, ...rest }) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.96 }}
      whileHover={disabled ? undefined : { scale: 1.005 }}
      transition={iosSpring.snappy}
      onClick={onClick}
      disabled={disabled}
      style={{ background: 'none', border: 'none', padding: 0, cursor: disabled ? 'default' : 'pointer', ...style }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

// Soft spring fade-in for cards / list items as they enter the viewport.
export function FadeInItem({ children, delay = 0, ...rest }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...iosSpring.smooth, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
