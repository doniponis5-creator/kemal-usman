// src/utils/sentry.js
// Sentry error tracking — production only. Never enabled in dev (DSN unset
// + the explicit `import.meta.env.DEV` guard) so local errors don't pollute
// the dashboard.

import * as Sentry from '@sentry/react'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN

export function initSentry() {
  // Skip in dev or if DSN not configured.
  if (!SENTRY_DSN || import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.info('[sentry] disabled in dev or no DSN set')
    return
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.VITE_APP_ENV || 'production',

    // Performance traces — sample 20% to stay inside the free tier quota.
    tracesSampleRate: 0.2,

    // 100% of errors captured (default — explicit for clarity).
    beforeSend(event) {
      // Strip phone numbers from error messages before sending.
      // Privacy: never send PII to Sentry. Covers +996/996/raw 10-12 digits.
      if (event.message) {
        event.message = event.message
          .replace(/\+?996\d{9}/g, '[PHONE]')
          .replace(/\d{10,12}/g,   '[PHONE]')
      }
      return event
    },

    // Ignore non-actionable noise that swamps the dashboard otherwise.
    ignoreErrors: [
      'Network request failed',
      'Failed to fetch',
      'Load failed',
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection',
    ],
  })
}

// Capture error manually (use in catch blocks). In dev, falls through to
// console.error so the developer still sees it without a Sentry roundtrip.
export function captureError(error, context = {}) {
  if (!SENTRY_DSN || import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error('[error]', error, context)
    return
  }
  Sentry.captureException(error, { extra: context })
}

// Set user context after login. Only the anonymous record id is sent —
// no phone, no name, no PII.
export function setSentryUser(userId) {
  if (!SENTRY_DSN) return
  Sentry.setUser(userId ? { id: userId } : null)
}

// Clear user on logout.
export function clearSentryUser() {
  if (!SENTRY_DSN) return
  Sentry.setUser(null)
}
