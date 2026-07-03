// Design system tokens & style helpers — extracted from App.jsx (P2.1).
// Rule: all colors come from T — never hardcode hex in JSX.

export const T = {
  bg: "var(--ku-bg, #F5F5F5)",
  bgSecond: "var(--ku-surface-2, #EEEEEE)",
  white: "var(--ku-surface, #FFFFFF)",
  accent: "var(--ku-accent, #111111)",
  accentDark: "#000000",
  accentLight: "var(--ku-fill, rgba(0,0,0,0.06))",
  accentPale: "var(--ku-fill-2, rgba(0,0,0,0.04))",
  text: "var(--ku-text, #111111)",
  textSecond: "var(--ku-text-2, #666666)",
  textMuted: "var(--ku-text-3, #AEAEB2)",
  border: "var(--ku-border, #EEEEEE)",
  card: "var(--ku-surface, #FFFFFF)",
  // iOS premium depth — tight contact + soft ambient (y:8, blur:20, low opacity)
  shadow:   "0 1px 2px rgba(0,0,0,0.04), 0 8px 20px rgba(0,0,0,0.06)",
  shadowSm: "0 1px 3px rgba(0,0,0,0.05), 0 4px 10px rgba(0,0,0,0.04)",
  shadowLg: "0 2px 4px rgba(0,0,0,0.05), 0 16px 32px rgba(0,0,0,0.10)",
  danger: "#E53935",
  success: "#43A047",
  successIOS: "#34C759",  // iOS system green — chips, paid/new states
  warning: "#FF9500",     // iOS system orange
  gold: "#C9A84C",        // premium accent (VIP/bonus)
  gray: "#8E8E93",        // iOS systemGray — legible in light AND dark
  bonus: "#FF6B00",
  referral: "#7C5CBF",
  navH: 64,
};

// Radius scale — snap every borderRadius to one of these (circles = size/2 are exempt).
export const R = { xs: 8, sm: 10, md: 12, lg: 14, xl: 16, xxl: 20, sheet: 24, pill: 999 };

// Card helper
export const card = (extra = {}) => ({
  background: T.card,
  borderRadius: 16,
  boxShadow: T.shadow,
  border: "none",
  ...extra,
});

export const inputStyle = {
  background: "var(--ku-surface-2, #F5F5F5)",
  border: "none",
  borderRadius: 12,
  color: T.text,
  fontSize: 16,
  padding: "13px 16px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  fontFamily: "inherit",
};

export const btnGreen = (extra = {}) => ({
  background: "var(--ku-accent, #111111)",
  color: "#fff",
  border: "none",
  borderRadius: 14,
  padding: "15px 20px",
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: -0.1,
  cursor: "pointer",
  width: "100%",
  boxSizing: "border-box",
  // iOS premium soft shadow — y:6, blur:16, low opacity
  boxShadow: "0 6px 16px rgba(17,17,17,0.18), 0 1px 3px rgba(0,0,0,0.08)",
  fontFamily: "inherit",
  transition: "transform 0.15s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.15s ease",
  ...extra,
});

export const btnOutline = (extra = {}) => ({
  background: "transparent",
  color: T.accent,
  border: `1.5px solid ${T.accent}`,
  borderRadius: 14,
  padding: "13px 20px",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
  ...extra,
});

