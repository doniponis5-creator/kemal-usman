import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { haptic } from '../utils/haptics';

// iOS bottom-sheet for sort + price filter. Slide up from bottom, dim backdrop,
// option pills with spring select state. Tapping outside or "Apply" closes.

const SORTS = [
  { id: 'default',    ru: 'По умолчанию',         kg: 'Алгачкы тартип' },
  { id: 'price_asc',  ru: 'Цена ↑',                kg: 'Баасы ↑' },
  { id: 'price_desc', ru: 'Цена ↓',                kg: 'Баасы ↓' },
  { id: 'name_asc',   ru: 'По названию A→Я',       kg: 'Аты А→Я' },
];

export function SortFilterSheet({ open, onClose, sort, onSortChange, lang = 'ru' }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 9990,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          }}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              background: '#fff',
              borderRadius: '24px 24px 0 0',
              padding: '14px 18px',
              paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0))',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
            }}
          >
            {/* drag-handle */}
            <div style={{ width: 36, height: 4, borderRadius: 4, background: '#E5E5E5', margin: '0 auto 18px' }} />

            <div style={{ fontSize: 17, fontWeight: 800, color: '#111', marginBottom: 18 }}>
              {lang === 'kg' ? 'Иргөө' : 'Сортировка'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SORTS.map((s) => {
                const selected = sort === s.id;
                return (
                  <motion.button
                    key={s.id}
                    onClick={() => { haptic('light'); onSortChange(s.id); }}
                    whileTap={{ scale: 0.98 }}
                    animate={{
                      borderColor: selected ? '#111' : '#EEE',
                      background: selected ? 'rgba(0,0,0,0.04)' : 'transparent',
                    }}
                    transition={{ duration: 0.18 }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: 14,
                      border: '1.5px solid',
                      cursor: 'pointer',
                      width: '100%',
                      fontSize: 15,
                      color: '#111',
                      fontWeight: selected ? 700 : 500,
                      textAlign: 'left',
                    }}
                  >
                    <span>{lang === 'kg' ? s.kg : s.ru}</span>
                    <AnimatePresence>
                      {selected && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 460, damping: 22 }}
                          style={{
                            width: 22, height: 22, borderRadius: 11,
                            background: '#111',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              style={{
                marginTop: 18, width: '100%',
                padding: '14px',
                borderRadius: 14,
                border: 'none',
                background: '#111',
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {lang === 'kg' ? 'Колдонуу' : 'Применить'}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
