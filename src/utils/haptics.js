// Capacitor Haptics wrapper. Falls back to navigator.vibrate on web.
// To install: npm i @capacitor/haptics
//
// Usage:
//   import { haptic } from '@/utils/haptics';
//   haptic('light');   // tap
//   haptic('medium');  // confirm
//   haptic('success'); // order placed
//   haptic('error');   // invalid input

let HapticsImpl = null;
try {
  // Lazy import — works only on native, swallowed on web.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  HapticsImpl = require('@capacitor/haptics');
} catch { /* not installed yet — fine */ }

const map = {
  light:   { kind: 'impact', style: 'LIGHT' },
  medium:  { kind: 'impact', style: 'MEDIUM' },
  heavy:   { kind: 'impact', style: 'HEAVY' },
  success: { kind: 'notification', style: 'SUCCESS' },
  warning: { kind: 'notification', style: 'WARNING' },
  error:   { kind: 'notification', style: 'ERROR' },
};

export function haptic(kind = 'light') {
  // Respect reduced-motion preference.
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const def = map[kind] || map.light;
  if (HapticsImpl?.Haptics) {
    if (def.kind === 'impact') HapticsImpl.Haptics.impact({ style: HapticsImpl.ImpactStyle?.[def.style] });
    else HapticsImpl.Haptics.notification({ type: HapticsImpl.NotificationType?.[def.style] });
    return;
  }
  // Web fallback.
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    const dur = kind === 'heavy' ? 30 : kind === 'medium' ? 18 : 10;
    navigator.vibrate(dur);
  }
}
