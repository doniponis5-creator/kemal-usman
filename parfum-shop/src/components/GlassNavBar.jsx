import React from 'react';
import { motion } from 'framer-motion';

/**
 * GlassNavBar — iOS 26 Liquid Glass floating bottom navigation.
 *
 * Mirrors the native SwiftUI bar in `LiquidGlassTabView.swift`:
 *   • white translucent capsule (`backdrop-filter` for the glass material)
 *   • selected tab gets a clean grey "pill" that slides between tabs via
 *     framer-motion's `layoutId` — this is the web equivalent of SwiftUI's
 *     `matchedGeometryEffect`. Combined with the outer glass blur this
 *     produces the Apple Music tab-bar feel.
 *   • snappy iOS 26 spring physics on every motion.
 */
const iosSpring = { type: 'spring', stiffness: 420, damping: 32, mass: 0.85 };

export function GlassNavBar({ items, active, onSelect }) {
  const handleSelect = (id) => {
    onSelect(id);
  };

  return (
    <div style={S.outer}>
      <div style={S.pill}>
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <Tab
              key={item.id}
              item={item}
              isActive={isActive}
              onClick={() => handleSelect(item.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function Tab({ item, isActive, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.94 }}
      transition={iosSpring}
      style={S.tabBtn}
      aria-label={item.label}
      aria-current={isActive ? 'page' : undefined}
    >
      {/* Sliding selected pill — layoutId gives smooth liquid morph
          between tabs (web equivalent of SwiftUI matchedGeometryEffect). */}
      {isActive && (
        <motion.div
          layoutId="ios26-selectedPill"
          transition={iosSpring}
          style={S.activePill}
        />
      )}

      <div style={S.tabContent}>
        <motion.div
          animate={{
            scale: isActive ? 1.06 : 1,
            color: isActive ? '#007AFF' : 'rgba(0,0,0,0.6)',
          }}
          transition={iosSpring}
          style={S.iconWrap}
        >
          {React.cloneElement(item.icon, { style: { width: 22, height: 22, display: 'block' } })}

          {item.badge > 0 && (
            <motion.div
              key={item.badge}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: [0.5, 1.2, 1], opacity: 1 }}
              transition={{ duration: 0.36, times: [0, 0.6, 1], ease: [0.32, 0.72, 0, 1] }}
              style={S.badge}
            >
              {item.badge > 99 ? '99+' : item.badge}
            </motion.div>
          )}
        </motion.div>

        <motion.span
          animate={{
            color: isActive ? '#007AFF' : 'rgba(0,0,0,0.6)',
            fontWeight: isActive ? 600 : 500,
          }}
          transition={iosSpring}
          style={S.label}
        >
          {item.label}
        </motion.span>
      </div>
    </motion.button>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  outer: {
    position: 'fixed',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
    left: 16,
    right: 16,
    zIndex: 1000,
    pointerEvents: 'none',
    display: 'flex',
    justifyContent: 'center',
  },

  // iOS 26 white Liquid Glass capsule — exact match of LiquidGlassTabView
  pill: {
    position: 'relative',
    width: '100%',
    maxWidth: 460,
    minHeight: 64,
    padding: 6,
    borderRadius: 32,
    pointerEvents: 'all',
    display: 'flex',
    alignItems: 'stretch',
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'saturate(180%) blur(40px)',
    WebkitBackdropFilter: 'saturate(180%) blur(40px)',
    border: '0.5px solid rgba(255, 255, 255, 0.55)',
    boxShadow:
      '0 14px 32px rgba(0, 0, 0, 0.12),' +
      '0 4px 10px rgba(0, 0, 0, 0.06),' +
      'inset 0 1px 0 rgba(255, 255, 255, 0.7)',
  },

  tabBtn: {
    flex: 1,
    height: 52,
    minWidth: 0,
    padding: 0,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    WebkitTapHighlightColor: 'transparent',
    fontFamily: 'inherit',
  },

  // Clean gray sliding pill — matches `Color(.systemGray5)` in
  // LiquidGlassTabView. Solid fill, no glass / no backdrop blur.
  activePill: {
    position: 'absolute',
    inset: 4,
    borderRadius: 24,
    background: 'rgba(118, 118, 128, 0.16)',
    boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.7)',
    zIndex: 0,
  },

  tabContent: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '0 4px',
  },

  iconWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    willChange: 'transform',
  },

  badge: {
    position: 'absolute',
    top: -7,
    right: -10,
    background: '#FF3B30',
    color: '#fff',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    padding: '0 5px',
    fontSize: 10,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
    letterSpacing: -0.2,
    lineHeight: 1,
  },

  label: {
    fontSize: 10.5,
    letterSpacing: -0.1,
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
  },
};
