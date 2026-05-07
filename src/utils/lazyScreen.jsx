// src/utils/lazyScreen.jsx
// Suspense wrapper + iOS-style spinner for any future React.lazy split.
//
// Currently unused — the screens still live inside App.jsx (see CLAUDE.md
// and the Task 7/8 fallback notes for why). Kept ready so a future
// extraction can wire it up without re-deciding the loading-state visuals.

import React, { Suspense } from 'react'

function ScreenSkeleton() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#FAF6EE',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
    }}>
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: '2.5px solid #F0D89A',
        borderTopColor: '#C9A84C',
        animation: 'lazy-spin 0.7s linear infinite',
      }} />
      <style>{`
        @keyframes lazy-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// HOC: wrap any lazy component with Suspense. Use:
//   const AdminScreen = withSuspense(lazy(() => import('./screens/AdminScreen')))
export function withSuspense(LazyComponent) {
  return function SuspenseWrapper(props) {
    return (
      <Suspense fallback={<ScreenSkeleton />}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}

export default withSuspense
