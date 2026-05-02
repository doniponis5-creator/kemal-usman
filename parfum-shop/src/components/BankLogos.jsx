import React from 'react';

// Inline-SVG bank logos. Self-contained — no /public assets, no path quirks,
// no Capacitor file:// issues, no missing-image fallbacks. Render reliably
// on iOS WKWebView, Android, and web. Scale crisply at any size.

const baseBox = (background, shadow) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  background,
  boxShadow: shadow,
});

export function MBankLogo({ size = 44, radius = 10 }) {
  return (
    <div
      style={{
        ...baseBox(
          'linear-gradient(135deg, #00B0AA 0%, #0E7A6E 60%, #053A35 100%)',
          '0 2px 6px rgba(14,122,110,0.28)'
        ),
        width: size,
        height: size,
        borderRadius: radius,
      }}
      aria-label="M Bank"
      role="img"
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none">
        <path
          d="M3 20 V 4 L 12 14 L 21 4 V 20"
          stroke="#fff"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

export function OBankLogo({ size = 44, radius = 10 }) {
  return (
    <div
      style={{
        ...baseBox(
          'linear-gradient(135deg, #FF5BAA 0%, #E5007E 60%, #960057 100%)',
          '0 2px 6px rgba(229,0,126,0.28)'
        ),
        width: size,
        height: size,
        borderRadius: radius,
      }}
      aria-label="O!Bank"
      role="img"
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 32 24" fill="none">
        {/* O */}
        <circle cx="11" cy="12" r="6.5" stroke="#fff" strokeWidth="3" fill="none" />
        {/* ! */}
        <line x1="22" y1="6" x2="22" y2="13.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        <circle cx="22" cy="17.5" r="1.6" fill="#fff" />
      </svg>
    </div>
  );
}

export function CashLogo({ size = 44, radius = 10 }) {
  return (
    <div
      style={{
        ...baseBox('#E8E8E8', 'none'),
        width: size,
        height: size,
        borderRadius: radius,
      }}
      aria-label="Cash"
      role="img"
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 26 26" fill="none">
        <rect x="1" y="5" width="24" height="16" rx="3" stroke="#555" strokeWidth="1.8" fill="none" />
        <circle cx="13" cy="13" r="3.5" stroke="#555" strokeWidth="1.8" fill="none" />
        <line x1="1" y1="9" x2="5" y2="9" stroke="#555" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="21" y1="17" x2="25" y2="17" stroke="#555" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </div>
  );
}
