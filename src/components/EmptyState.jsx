import React from 'react';
import { motion } from 'framer-motion';

// Reusable premium empty-state. Spring-bouncy icon, staggered text, optional CTA.
// Follows the project iOS design tokens: 8/12/16/20 spacing, layered subtle
// shadow on the icon container, system blue/black accents come from caller.
//
// Usage:
//   <EmptyState
//     icon={IC.cart}
//     title={t.cartEmpty}
//     hint={t.cartEmptyHint}
//     action={<button onClick={...}>Перейти в каталог</button>}
//   />

const easeIOS = [0.32, 0.72, 0, 1];

export function EmptyState({ icon, title, hint, action }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.32 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 16,
        padding: '32px 20px',
        textAlign: 'center',
      }}
    >
      {/* Icon container — iOS-style layered depth (subtle contact + ambient) */}
      <motion.div
        initial={{ scale: 0.5, rotate: -10, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.05 }}
        style={{
          width: 96,
          height: 96,
          borderRadius: 28,
          background: '#FFFFFF',
          boxShadow:
            '0 1px 2px rgba(0,0,0,0.05),' +
            '0 8px 24px rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#111',
        }}
      >
        {icon && React.isValidElement(icon)
          ? React.cloneElement(icon, { style: { width: 40, height: 40 } })
          : icon}
      </motion.div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.3, ease: easeIOS }}
        style={{
          color: '#111',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: -0.3,
          lineHeight: 1.25,
          marginTop: 4,
        }}
      >
        {title}
      </motion.div>

      {/* Hint — secondary text */}
      {hint && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24, duration: 0.3, ease: easeIOS }}
          style={{
            color: '#8E8E93',
            fontSize: 14,
            maxWidth: 280,
            lineHeight: 1.5,
            marginTop: -8,
          }}
        >
          {hint}
        </motion.div>
      )}

      {/* Action — CTA */}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.3, ease: easeIOS }}
          style={{ marginTop: 12 }}
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
