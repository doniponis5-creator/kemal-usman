import React from 'react';
import { motion } from 'framer-motion';
import { haptic } from '../utils/haptics';

/**
 * GlassNavBar — нижняя навигация в монохроме бренда: белая полоса во всю
 * ширину, прижата к низу, тонкая линия сверху. Выбранная вкладка: чёрный
 * значок и подпись + короткая чёрная черта над значком, черта переезжает
 * между вкладками. У всех вкладок есть подписи.
 * На iOS вкладки покупателя рисует нативный SwiftUI-бар (LiquidGlassTabView);
 * этот компонент там показывается только в админке.
 */
const spring = { type: 'spring', stiffness: 520, damping: 40, mass: 0.8 };

export function GlassNavBar({ items, active, onSelect }) {
  return (
    <nav style={S.outer} aria-label="Навигация">
      <div style={S.bar}>
        {items.map((item) => (
          <Tab
            key={item.id}
            item={item}
            isActive={item.id === active}
            onClick={() => {
              if (item.id !== active) haptic('light');
              onSelect(item.id);
            }}
          />
        ))}
      </div>
    </nav>
  );
}

function Tab({ item, isActive, onClick }) {
  const color = isActive ? '#111111' : '#8A8A8E';
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      transition={spring}
      aria-label={item.badge > 0 ? `${item.label}, ${item.badge}` : item.label}
      aria-current={isActive ? 'page' : undefined}
      style={S.tab}
    >
      {isActive && <motion.span layoutId="ku-nav-mark" transition={spring} style={S.lineMark} />}

      <span style={{ ...S.icon, color }}>
        {React.cloneElement(item.icon, { width: 22, height: 22, strokeWidth: isActive ? 2.1 : 1.7, style: { display: 'block' } })}
        {item.badge > 0 && (
          <motion.span
            key={item.badge}
            initial={{ scale: 0.4 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 600, damping: 16 }}
            style={S.badge}
          >
            {item.badge > 99 ? '99+' : item.badge}
          </motion.span>
        )}
      </span>

      <span style={{ ...S.label, color, fontWeight: isActive ? 600 : 500 }}>{item.label}</span>
    </motion.button>
  );
}

const S = {
  outer: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    background: 'rgba(255, 255, 255, 0.94)',
    backdropFilter: 'saturate(160%) blur(20px)',
    WebkitBackdropFilter: 'saturate(160%) blur(20px)',
    borderTop: '1px solid rgba(17, 17, 17, 0.08)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  },
  bar: {
    height: 58,
    maxWidth: 560,
    margin: '0 auto',
    padding: '0 6px',
    display: 'flex',
    alignItems: 'stretch',
  },
  tab: {
    flex: '1 1 0',
    minWidth: 0,
    position: 'relative',
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    WebkitTapHighlightColor: 'transparent',
    fontFamily: 'inherit',
  },
  icon: {
    position: 'relative',
    display: 'flex',
    transition: 'color 0.2s ease',
  },
  label: {
    fontSize: 10.5,
    letterSpacing: '-0.005em',
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '100%',
    padding: '0 2px',
    transition: 'color 0.2s ease',
  },
  // Черта над значком выбранной вкладки.
  lineMark: {
    position: 'absolute',
    top: 0,
    left: '50%',
    width: 22,
    height: 2,
    marginLeft: -11,
    borderRadius: 2,
    background: '#111111',
  },
  // Счётчик в монохроме бренда: белый кружок с тонкой чёрной обводкой,
  // без красного; не сливается с чёрным значком выбранной вкладки.
  badge: {
    position: 'absolute',
    top: -4,
    right: -9,
    minWidth: 15,
    height: 15,
    padding: '0 3.5px',
    borderRadius: 8,
    border: '1px solid #111111',
    background: '#FFFFFF',
    color: '#111111',
    fontSize: 9,
    fontWeight: 600,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontVariantNumeric: 'tabular-nums',
  },
};
