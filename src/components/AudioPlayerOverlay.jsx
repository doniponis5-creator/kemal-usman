// AudioPlayerOverlay — bottom-strip audio preview for ProductCard.
//
// Layout (sits inside the image container, no center button):
//   [ ▶ ]  ▓▓▓▓░░░░░░░░  0:12 / 0:45
//   ── 40% bottom gradient: transparent → rgba(0,0,0,0.65) ──
//
// Engine: the shared `useAudioPlayer` singleton. Switching to another card or
// the detail player auto-pauses this one (only one source can play at a time).
// No `expo-av` (this is a Capacitor web shell, not Expo); HTMLAudioElement
// works natively inside WKWebView.
import React from "react";
import { motion } from "framer-motion";
import { audioUrl } from "../api/pb";
import { useAudioPlayer } from "../api/audioPlayer";

const fmt = (s) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

export default function AudioPlayerOverlay({ product }) {
  const pid = product?.id;
  const localKey = pid ? "parfum_audio_" + pid : null;
  const localData = (typeof window !== "undefined" && localKey) ? localStorage.getItem(localKey) : null;
  const pbAudio = product ? audioUrl(product) : null;
  const src = pbAudio || localData || null;

  const player = useAudioPlayer();
  const isMine = !!src && player.currentSrc === src;
  const isPlaying = isMine && player.isPlaying;
  const isLoading = isMine && player.isLoading;
  const duration = isMine && player.duration > 0 ? player.duration : 0;
  const currentTime = isMine ? player.currentTime : 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const trackRef = React.useRef(null);

  if (!src) return null;

  const handleToggle = (e) => {
    e.stopPropagation();
    try { if (typeof window !== "undefined" && window.haptic) window.haptic("light"); } catch { /* noop */ }
    player.toggle(src);
  };

  // Tap anywhere on the progress track to seek.
  const handleSeek = (e) => {
    e.stopPropagation();
    if (!trackRef.current || !duration) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = (e.clientX ?? e.touches?.[0]?.clientX ?? rect.left) - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    player.seek(ratio * duration);
  };

  return (
    <>
      {/* Bottom 40% darkening so white player text stays readable on any photo */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "40%",
          background: "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.65) 100%)",
          pointerEvents: "none",
          zIndex: 9,
        }}
      />

      {/* Player strip — pinned to the image bottom */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left: 10,
          right: 10,
          bottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 10,
          zIndex: 10,
        }}
      >
        {/* Play / Pause button — 32px white circle, dark icon */}
        <motion.button
          type="button"
          onClick={handleToggle}
          whileTap={{ scale: 0.92 }}
          aria-label={isPlaying ? "Pause audio" : "Play audio"}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            padding: 0,
            background: "#FFFFFF",
            border: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.30)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#111",
            flexShrink: 0,
          }}
        >
          {isLoading ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              style={{
                width: 12,
                height: 12,
                border: "1.6px solid rgba(17,17,17,0.25)",
                borderTopColor: "#111",
                borderRadius: "50%",
                display: "inline-block",
              }}
            />
          ) : isPlaying ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1.2" />
              <rect x="14" y="4" width="4" height="16" rx="1.2" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 1 }}>
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
          )}
        </motion.button>

        {/* Progress track — 3px, white over white@30%, seekable */}
        <div
          ref={trackRef}
          onClick={handleSeek}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 1.5,
            background: "rgba(255,255,255,0.30)",
            cursor: "pointer",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress * 100}%`,
              background: "#FFFFFF",
              borderRadius: 1.5,
              transition: "width 0.12s linear",
            }}
          />
        </div>

        {/* Time — 10px white monospace */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: "#FFFFFF",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
            letterSpacing: -0.1,
            textShadow: "0 1px 2px rgba(0,0,0,0.4)",
          }}
        >
          {fmt(currentTime)} / {fmt(duration || 0)}
        </span>
      </div>
    </>
  );
}
