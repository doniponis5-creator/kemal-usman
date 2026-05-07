// AudioHintTooltip — first-time discovery bubble for the audio player.
//
// Behavior (per spec):
//   • Only shows for "new" users — counter capped at 5 lifetime launches.
//   • Counter persisted via localStorage key "audio_hint_count" (Capacitor's
//     WKWebView keeps localStorage across launches; this is the web equivalent
//     of AsyncStorage).
//   • Appears 1.5s after mount, fades in over 300ms.
//   • Auto-dismisses after 4s OR on tap anywhere → fade out 300ms.
//   • Renders absolutely above the bottom audio strip on the first card.
//   • Visual: dark bubble (#1A1208), gold border (#C9A84C), down-pointing arrow.
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "audio_hint_count";
const MAX_SHOWS = 5;

// Gate evaluated ONCE per mount of the catalog. Increments + saves the counter
// inline so this can also be called from outside (e.g. CatalogScreen on mount).
export function shouldShowAudioHint() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const count = parseInt(raw || "0", 10) || 0;
    if (count >= MAX_SHOWS) return false;
    localStorage.setItem(STORAGE_KEY, String(count + 1));
    return true;
  } catch {
    return false;
  }
}

export default function AudioHintTooltip({ text, visible, onDismiss }) {
  // Auto-dismiss after 4s while visible.
  React.useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => { onDismiss?.(); }, 4000);
    return () => clearTimeout(id);
  }, [visible, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="audio-hint"
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -2 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
          style={{
            position: "absolute",
            // Sits just above the bottom audio strip (player is at bottom: 10
            // with a 32px-tall button → strip top edge ≈ bottom: 42).
            // Tooltip + arrow want ~14px clearance above that.
            left: 8,
            right: 8,
            bottom: 56,
            zIndex: 20,
            display: "flex",
            justifyContent: "flex-start",
          }}
        >
          <div
            style={{
              position: "relative",
              background: "#1A1208",
              border: "1px solid #C9A84C",
              borderRadius: 12,
              padding: "8px 12px",
              color: "#FFFFFF",
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: -0.1,
              maxWidth: "100%",
              boxShadow: "0 4px 12px rgba(0,0,0,0.30)",
            }}
          >
            {text}
            {/* Down-pointing arrow — diamond rotated 45°, only the bottom-right
                edges visible, so it inherits the gold border + dark fill. */}
            <div
              style={{
                position: "absolute",
                bottom: -6,
                left: 14,
                width: 10,
                height: 10,
                background: "#1A1208",
                borderRight: "1px solid #C9A84C",
                borderBottom: "1px solid #C9A84C",
                transform: "rotate(45deg)",
                borderRadius: "0 0 2px 0",
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
