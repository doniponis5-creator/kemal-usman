import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig, LazyMotion, domAnimation } from 'framer-motion'
import './index.css'
// FIX (HIGH): wrap the entire app in an ErrorBoundary so a single render
// exception no longer turns into a white screen on iOS WKWebView.
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
// Initialize Sentry FIRST so any subsequent error (init code, render, native
// shell setup) is captured. The function is a no-op in dev / when DSN is
// unset, so this is safe to call unconditionally.
import { initSentry } from './utils/sentry'
initSentry()
import App from './App.jsx'

// PRO: configure native iOS / Android shell — status bar style, splash hide, keyboard adjust.
// Each plugin is dynamically imported and silently no-ops on web.
async function initNativeShell() {
  try {
    const sbMod = await import(/* @vite-ignore */ '@capacitor/' + 'status-bar')
    if (sbMod?.StatusBar) {
      // iOS premium full-screen: WebView extends UNDER the status bar so
      // backgrounds (like the LoginScreen image) flow edge-to-edge. Each
      // screen toggles `Light` (white text on dark) or `Default`/`Dark`
      // (black text on light) via `setStatusBarStyle()` from App.jsx.
      await sbMod.StatusBar.setOverlaysWebView?.({ overlay: true }).catch(() => {})
      await sbMod.StatusBar.setStyle({ style: sbMod.Style?.Light || 'LIGHT' }).catch(() => {})
    }
    // Expose a global helper React screens can call to flip status-bar tint.
    window.__setStatusBarStyle = async (mode) => {
      try {
        const m = await import(/* @vite-ignore */ '@capacitor/' + 'status-bar')
        if (!m?.StatusBar) return
        const s = mode === 'light' ? (m.Style?.Light || 'LIGHT') : (m.Style?.Dark || 'DARK')
        m.StatusBar.setStyle({ style: s }).catch(() => {})
      } catch {}
    }
  } catch { /* not on native or plugin not installed */ }
  try {
    const splashMod = await import(/* @vite-ignore */ '@capacitor/' + 'splash-screen')
    splashMod?.SplashScreen?.hide?.({ fadeOutDuration: 300 }).catch(() => {})
  } catch { /* not on native */ }
  try {
    const kbMod = await import(/* @vite-ignore */ '@capacitor/' + 'keyboard')
    const KB = kbMod?.Keyboard
    if (!KB) return
    KB.setAccessoryBarVisible?.({ isVisible: false }).catch(() => {})
    // Drive --keyboard-height so any element using it transitions smoothly.
    // Also scroll the focused element into view without a viewport jump.
    KB.addListener?.('keyboardWillShow', (info) => {
      const h = info?.keyboardHeight ?? 0
      document.documentElement.style.setProperty('--keyboard-height', `${h}px`)
      // Defer scroll until keyboard is visible so position is stable.
      requestAnimationFrame(() => {
        const el = document.activeElement
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
      })
    }).catch?.(() => {})
    KB.addListener?.('keyboardWillHide', () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px')
    }).catch?.(() => {})
  } catch { /* not on native */ }
}
initNativeShell()

// (Old dynamic-import Sentry stub removed — initSentry() above handles it.)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {/* MotionConfig — global default spring tuned for 120Hz feel. Any
          motion.* without an explicit `transition` inherits this. Components
          that already specify their own transition (most of App.jsx) are
          unaffected.
          LazyMotion + domAnimation — pulls only the dom-animation feature
          set, trimming framer-motion's parse cost on first paint. `strict`
          stays at its default (false) so existing `motion.*` keeps working
          without rewriting to `m.*`.
          reducedMotion="user" — respects iOS Settings → Accessibility →
          Reduce Motion. */}
      <MotionConfig
        reducedMotion="user"
        transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.8 }}
      >
        <LazyMotion features={domAnimation}>
          <App />
        </LazyMotion>
      </MotionConfig>
    </ErrorBoundary>
  </StrictMode>,
)
