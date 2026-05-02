import React from 'react';
import { motion } from 'framer-motion';

// Reusable premium empty-state. Spring-bouncy icon, staggered text, optional CTA.
// Usage:
//   <EmptyState
//     icon={IC.cart}
//     title={t.cartEmpty}
//     hint={t.cartEmptyHint}
//     action={<button onClick={...}>Перейти в каталог</button>}
//   />

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
        gap: 14,
        padding: 32,
        textAlign: 'center',
      }}
    >
      {/* Icon — spring scale from 0 with a slight rotate for bounce-feel */}
      <motion.div
        initial={{ scale: 0.5, rotate: -10, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.05 }}
        style={{
          width: 96,
          height: 96,
          borderRadius: 28,
          background: 'rgba(0,0,0,0.04)',
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
        transition={{ delay: 0.18, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        style={{ color: '#111', fontSize: 18, fontWeight: 700 }}
      >
        {title}
      </motion.div>

      {/* Hint */}
      {hint && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          style={{
            color: '#999',
            fontSize: 14,
            maxWidth: 280,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </motion.div>
      )}

      {/* Action */}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          style={{ marginTop: 12 }}
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}
