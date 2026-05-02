import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// FIX (HIGH): wrap the entire app in an ErrorBoundary so a single render
// exception no longer turns into a white screen on iOS WKWebView.
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import App from './App.jsx'

// PRO: configure native iOS / Android shell — status bar style, splash hide, keyboard adjust.
// Each plugin is dynamically imported and silently no-ops on web.
async function initNativeShell() {
  try {
    const sbMod = await import(/* @vite-ignore */ '@capacitor/' + 'status-bar')
    if (sbMod?.StatusBar) {
      await sbMod.StatusBar.setStyle({ style: sbMod.Style?.Dark || 'DARK' }).catch(() => {})
      await sbMod.StatusBar.setBackgroundColor?.({ color: '#ffffff' }).catch(() => {})
      await sbMod.StatusBar.setOverlaysWebView?.({ overlay: false }).catch(() => {})
    }
  } catch { /* not on native or plugin not installed */ }
  try {
    const splashMod = await import(/* @vite-ignore */ '@capacitor/' + 'splash-screen')
    splashMod?.SplashScreen?.hide?.({ fadeOutDuration: 300 }).catch(() => {})
  } catch { /* not on native */ }
  try {
    const kbMod = await import(/* @vite-ignore */ '@capacitor/' + 'keyboard')
    kbMod?.Keyboard?.setAccessoryBarVisible?.({ isVisible: false }).catch(() => {})
  } catch { /* not on native */ }
}
initNativeShell()

// Optional: hook Sentry once VITE_SENTRY_DSN is set in .env.production.
// Use a runtime-computed string so Vite's static scanner doesn't try to
// resolve @sentry/react at build time when the package isn't installed.
if (import.meta.env.VITE_SENTRY_DSN) {
  const sentryPkg = '@sentry/' + 'react' // string-built at runtime → invisible to Vite scanner
  import(/* @vite-ignore */ sentryPkg).then(({ init }) => {
    init({ dsn: import.meta.env.VITE_SENTRY_DSN, environment: import.meta.env.MODE })
  }).catch(() => {})
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
