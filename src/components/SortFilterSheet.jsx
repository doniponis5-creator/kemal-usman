import { motion, AnimatePresence } from 'framer-motion';
import { haptic } from '../utils/haptics';
import { BottomSheet } from './BottomSheet';

// iOS bottom-sheet for sort + price filter — now built on the shared
// BottomSheet primitive (grabber, blur backdrop, spring, drag-to-dismiss).
// Content and public props are unchanged.

const SORTS = [
  { id: 'default',    ru: 'По умолчанию',         kg: 'Алгачкы тартип' },
  { id: 'price_asc',  ru: 'Цена ↑',                kg: 'Баасы ↑' },
  { id: 'price_desc', ru: 'Цена ↓',                kg: 'Баасы ↓' },
  { id: 'name_asc',   ru: 'По названию A→Я',       kg: 'Аты А→Я' },
];

export function SortFilterSheet({ open, onClose, sort, onSortChange, lang = 'ru' }) {
  return (
    <BottomSheet open={open} onClose={onClose} label={lang === 'kg' ? 'Иргөө' : 'Сортировка'}>
      <div style={{ padding: '4px 18px 24px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ku-text, #111111)', marginBottom: 18 }}>
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
                  borderColor: selected ? 'var(--ku-accent, #111111)' : 'var(--ku-border, #EEEEEE)',
                  background: selected ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0)',
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
                  color: 'var(--ku-text, #111111)',
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
                        width: 22, height: 22, borderRadius: 12,
                        background: 'var(--ku-accent, #111111)',
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
          onClick={() => { haptic('light'); onClose(); }}
          style={{
            marginTop: 18, width: '100%',
            padding: '14px',
            borderRadius: 14,
            border: 'none',
            background: 'var(--ku-accent, #111111)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {lang === 'kg' ? 'Колдонуу' : 'Применить'}
        </motion.button>
      </div>
    </BottomSheet>
  );
}
