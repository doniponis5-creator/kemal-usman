// ───────────────────────────────────────────────────────────────────────────
// iOS 26 Liquid Glass — material system for the NATIVE app only.
//
// Apple's rule (Landmarks sample + HIG): Liquid Glass lives on the NAVIGATION
// layer floating above content — tab bars, headers, sheets, controls. NEVER on
// content (product cards, images, lists). Content stays solid and primary.
//
// WEB SAFETY: glassOr() returns the caller's existing style untouched unless
// IS_NATIVE. The browser build is never altered.
//
// Recipe mirrors Apple's documented pre-iOS-26 fallback:
//   ultraThinMaterial + white top-edge highlight + hairline border.
// ───────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react';
import { IS_NATIVE } from './utils/platform';
import { iosSpring, iosEase } from './components/MotionScreen';

export { iosSpring, iosEase };

// Apple radii (Landmarks Constants.swift: standard 15, glass 24) blended with
// the app's existing scale (card 16, control 14).
export const GLASS_RADIUS = { control: 14, card: 16, panel: 20, capsule: 999, sheet: 28 };

function hexToRgba(hex, a) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// Core material. variant: 'regular' | 'clear' | 'thick'.
function material(variant, scheme, opts) {
  const { tint, reduceTransparency } = opts || {};
  const dark = scheme === 'dark';

  let fill = dark ? 0.55 : 0.62;
  let blur = 22;
  if (variant === 'clear') { fill = dark ? 0.34 : 0.40; blur = 16; }
  if (variant === 'thick') { fill = dark ? 0.78 : 0.84; blur = 30; }
  if (reduceTransparency) { fill = 0.96; blur = 0; }

  const base = dark ? '24,24,27' : '255,255,255';
  let background = `rgba(${base}, ${fill})`;
  if (tint) {
    const t = hexToRgba(tint, dark ? 0.26 : 0.20);
    background = `linear-gradient(0deg, ${t}, ${t}), rgba(${base}, ${fill})`;
  }

  const hair = dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.55)';
  const specular = dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.70)';
  const ambient = dark
    ? '0 10px 30px rgba(0,0,0,0.50), 0 2px 8px rgba(0,0,0,0.35)'
    : '0 10px 28px rgba(20,16,8,0.12), 0 2px 8px rgba(20,16,8,0.06)';

  return {
    background,
    backdropFilter: blur ? `saturate(180%) blur(${blur}px)` : 'saturate(140%)',
    WebkitBackdropFilter: blur ? `saturate(180%) blur(${blur}px)` : 'saturate(140%)',
    border: `0.5px solid ${hair}`,
    boxShadow: `${ambient}, inset 0 0.5px 0 ${specular}`,
  };
}

/** Raw glass surface style. Assumes native context; callers gate via glassOr/IS_NATIVE. */
export function glassSurface(o) {
  const opts = o || {};
  const variant = opts.variant || 'regular';
  const scheme = opts.scheme || 'light';
  const radius = opts.radius != null ? opts.radius : GLASS_RADIUS.panel;
  return {
    ...material(variant, scheme, { tint: opts.tint || null, reduceTransparency: !!opts.reduceTransparency }),
    borderRadius: radius,
    WebkitTapHighlightColor: 'transparent',
  };
}

/** WEB-SAFE gate: glass only on native; the web build gets `webStyle` unchanged. */
export function glassOr(webStyle, glassOpts) {
  if (!IS_NATIVE) return webStyle;
  return { ...(webStyle || {}), ...glassSurface(glassOpts || {}) };
}

/** Apple's legibility gradient (Landmarks ReadabilityRoundedRectangle): black→clear. */
export function readabilityGradient(strength) {
  const s = strength == null ? 0.8 : strength;
  return `linear-gradient(to top, rgba(0,0,0,${s}) 0%, rgba(0,0,0,0) 55%)`;
}

/** Ink (text/tint) colors that sit correctly on glass per scheme. */
export const glassInk = (scheme) => (scheme === 'dark'
  ? { primary: 'rgba(255,255,255,0.96)', secondary: 'rgba(235,235,245,0.62)', tint: '#0A84FF' }
  : { primary: 'rgba(0,0,0,0.92)', secondary: 'rgba(60,60,67,0.60)', tint: '#007AFF' });

const mm = (q) => (typeof matchMedia !== 'undefined' ? matchMedia(q) : null);

/** Current color scheme. WEB IS ALWAYS 'light' — dark mode never touches the browser. */
export function useColorScheme() {
  // Single source of truth = html[data-theme] (set by main.jsx from the system,
  // and forced to 'light' while in the admin panel). Keeps CSS vars and JS glass
  // perfectly in sync.
  const read = () => (IS_NATIVE && typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const [scheme, setScheme] = useState(read);
  useEffect(() => {
    if (!IS_NATIVE || typeof document === 'undefined') return undefined;
    const el = document.documentElement;
    const update = () => setScheme(el.dataset.theme === 'dark' ? 'dark' : 'light');
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    update();
    return () => obs.disconnect();
  }, []);
  return scheme;
}

/** Honor iOS Settings → Accessibility → Reduce Transparency. */
export function useReducedTransparency() {
  const read = () => !!(mm('(prefers-reduced-transparency: reduce)') && mm('(prefers-reduced-transparency: reduce)').matches);
  const [v, setV] = useState(read);
  useEffect(() => {
    const q = mm('(prefers-reduced-transparency: reduce)');
    if (!q) return undefined;
    const on = () => setV(q.matches);
    q.addEventListener && q.addEventListener('change', on);
    return () => q.removeEventListener && q.removeEventListener('change', on);
  }, []);
  return v;
}

/** Bound style factory: g(opts) -> glass style for the current scheme + a11y.
 *  Also exposes g.scheme, g.ink, g.isNative. Web returns light + IS_NATIVE=false. */
export function useGlass() {
  const scheme = useColorScheme();
  const reduceTransparency = useReducedTransparency();
  return useMemo(() => ({
    style: (opts) => glassSurface({ scheme, reduceTransparency, ...(opts || {}) }),
    scheme,
    ink: glassInk(scheme),
    isNative: IS_NATIVE,
  }), [scheme, reduceTransparency]);
}
