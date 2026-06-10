import React from 'react';

// Brandmark logos — transparent background, brand-colored strokes.
// No colored container box. Render reliably on iOS WKWebView, Android, web.
// Default width 32px; height follows viewBox aspect so it scales cleanly.

// `size` now drives HEIGHT (per design spec: payment-row logos = 28px tall).
// Width follows viewBox aspect ratio so logos remain proportional.
const wrap = (size, w, h) => ({
  height: size,
  width: size * (w / h),
  flexShrink: 0,
  display: 'block',
  objectFit: 'contain',
});

export function MBankLogo({ size = 28 }) {
  return (
    <img
      src={encodeURI('/M bank.png')}
      alt="M Bank"
      style={{
        height: size,
        width: size,
        objectFit: 'contain',
        flexShrink: 0,
        display: 'block',
        borderRadius: 6,
      }}
    />
  );
}


// Square viewBox so the cash icon renders in the same N×N footprint as the
// bank logo <img> tags — keeps the payment list visually consistent.
export function CashLogo({ size = 28, color = '#3A3A3C' }) {
  return (
    <svg
      style={{ width: size, height: size, flexShrink: 0, display: 'block', objectFit: 'contain' }}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Cash"
      role="img"
    >
      {/* Banknote — centered in a 24×24 square */}
      <rect x="2.5" y="6.5" width="19" height="11" rx="2.5" stroke={color} strokeWidth="1.8" fill="none" />
      <circle cx="12" cy="12" r="2.6" stroke={color} strokeWidth="1.8" fill="none" />
      <line x1="2.5" y1="9.5" x2="5.5" y2="9.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="18.5" y1="14.5" x2="21.5" y2="14.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
