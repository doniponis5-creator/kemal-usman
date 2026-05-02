import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NumberCounter } from './NumberCounter';
import { haptic } from '../utils/haptics';

// Premium celebration modal — used when the user receives a welcome /
// referral / loyalty bonus. Confetti rays + spring gift icon + counter.
// Auto-dismisses after 3.5 s; tapping anywhere also closes.

const PALETTE = ['#FF6B00', '#FFD700', '#34C759', '#007AFF', '#FF3B30', '#AF52DE'];

// 24 confetti shards arranged in a radial fan
const PARTICLES = Array.from({ length: 24 }, (_, i) => {
  const angle = (i / 24) * Math.PI * 2;
  const dist = 110 + Math.random() * 60;
  return {
    id: i,
    angle,
    dx: Math.cos(angle) * dist,
    dy: Math.sin(angle) * dist - 20, // bias upward
    rotate: Math.random() * 720 - 360,
    color: PALETTE[i % PALETTE.length],
    delay: 0.18 + Math.random() * 0.25,
    duration: 1.2 + Math.random() * 0.6,
    size: 6 + Math.random() * 6,
    shape: i % 3, // 0=square, 1=circle, 2=stripe
  };
});

const giftIcon = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" rx="1" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
  </svg>
);

export function BonusCelebration({ amount, title, subtitle, ctaLabel, onClose, lang = 'ru' }) {
  // Success haptic the instant the modal mounts.
  useEffect(() => {
    haptic('success');
    const t = setTimeout(() => onClose?.(), 3800);
    return () => clearTimeout(t);
  }, [onClose]);

  const ttl = title || (lang === 'kg' ? 'Кош келүү бонусу' : 'Приветственный бонус');
  const sub = subtitle || (lang === 'kg' ? 'Бонус балансыңызга кошулду' : 'Зачислены на ваш бонусный счёт');
  const cta = ctaLabel || (lang === 'kg' ? 'Сонун!' : 'Отлично');

  return (
    <AnimatePresence>
      <motion.div
        key="celebration-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 10001,
          background: 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <motion.div
          initial={{ scale: 0.6, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#fff',
            borderRadius: 32,
            padding: '44px 32px 32px',
            width: '100%',
            maxWidth: 340,
            textAlign: 'center',
            position: 'relative',
            boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
          }}
        >
          {/* Gift icon — origin of confetti rays */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
            <motion.div
              initial={{ scale: 0.4, rotate: -25 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 14, delay: 0.05 }}
              style={{
                width: 84, height: 84, borderRadius: 26,
                background: 'linear-gradient(135deg, #FFB627 0%, #FF6B00 60%, #FF3B30 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 14px 32px rgba(255,107,0,0.45)',
                position: 'relative', zIndex: 2,
              }}
            >
              {giftIcon}
            </motion.div>

            {/* Confetti rays — emanate from gift icon center */}
            {PARTICLES.map((p) => (
              <motion.div
                key={p.id}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0, rotate: 0 }}
                animate={{
                  x: p.dx,
                  y: p.dy,
                  opacity: [0, 1, 1, 0],
                  scale: [0, 1, 1, 0.4],
                  rotate: p.rotate,
                }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  times: [0, 0.15, 0.7, 1],
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  marginTop: -p.size / 2,
                  marginLeft: -p.size / 2,
                  width: p.shape === 2 ? p.size * 1.6 : p.size,
                  height: p.shape === 2 ? p.size * 0.5 : p.size,
                  borderRadius: p.shape === 1 ? '50%' : 2,
                  background: p.color,
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />
            ))}
          </div>

          {/* Eyebrow label */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.3 }}
            style={{
              fontSize: 11, color: '#999',
              textTransform: 'uppercase', letterSpacing: 1.4,
              marginBottom: 8, fontWeight: 700,
            }}
          >
            {ttl}
          </motion.div>

          {/* Big counter */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.32 }}
            style={{
              fontSize: 42, fontWeight: 900, color: '#111',
              marginBottom: 8, letterSpacing: -1,
              lineHeight: 1.1,
            }}
          >
            +<NumberCounter value={amount} duration={1.4} delay={0.5} /> {lang === 'kg' ? 'сом' : 'сом'}
          </motion.div>

          {/* Subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.32 }}
            style={{
              fontSize: 14, color: '#666',
              marginBottom: 28, lineHeight: 1.5,
            }}
          >
            {sub}
          </motion.div>

          {/* CTA */}
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.32 }}
            whileTap={{ scale: 0.96 }}
            onClick={onClose}
            style={{
              width: '100%',
              padding: 14,
              borderRadius: 14,
              border: 'none',
              background: '#111',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: 0.4,
            }}
          >
            {cta}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
