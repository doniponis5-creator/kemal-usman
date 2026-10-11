// AudioPlayerOverlay — audio preview for ProductCard.
//
// Маленькая полупрозрачная кнопка ▶ в углу фото (30px, без тени) — не спорит
// с флаконом. Во время прослушивания по краю идёт кольцо: сколько прослушано
// (как в Apple Music).
//
// Engine: the shared `useAudioPlayer` singleton. Switching to another card or
// the detail player auto-pauses this one (only one source can play at a time).
// No `expo-av` (this is a Capacitor web shell, not Expo); HTMLAudioElement
// works natively inside WKWebView.
import { motion } from "framer-motion";
import { audioUrl } from "../api/pb";
import { useAudioPlayer } from "../api/audioPlayer";
import { haptic } from "../utils/haptics";

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

  if (!src) return null;

  const handleToggle = (e) => {
    e.stopPropagation();
    try { haptic("light"); } catch { /* noop */ }
    player.toggle(src);
  };

  // Кольцо вокруг ▶ показывает, сколько прослушано: заполняется по часовой стрелке.
  const active = isMine && (isPlaying || isLoading || currentTime > 0);
  const R = 12;
  const C = 2 * Math.PI * R;
  const left = Math.max(0, (duration || 0) - currentTime);

  return (
    <motion.button
      type="button"
      onClick={handleToggle}
      whileTap={{ scale: 0.92 }}
      aria-label={(isPlaying ? "Pause audio" : "Play audio") + (active && duration ? `, осталось ${fmt(left)}` : "")}
      style={{
        position: "absolute",
        left: 8,
        bottom: 8,
        zIndex: 10,
        width: 30,
        height: 30,
        borderRadius: "50%",
        padding: 0,
        // Плотный белый вместо «стекла» (backdrop-filter): кнопка стоит на каждой
        // карточке ленты (~40 штук), и размытие под каждой телефон пересчитывал на
        // каждом кадре прокрутки — лента шла рывками.
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(17,17,17,0.08)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--ku-text, #111111)",
      }}
    >
      {active && (
        <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"
          style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx="15" cy="15" r={R} fill="none" stroke="rgba(17,17,17,0.12)" strokeWidth="2" />
          <circle cx="15" cy="15" r={R} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
            style={{ transition: "stroke-dashoffset 0.2s linear" }} />
        </svg>
      )}
      {isLoading ? (
        <motion.span
          animate={{ rotate: 360 }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          style={{
            width: 10,
            height: 10,
            border: "1.6px solid rgba(17,17,17,0.25)",
            borderTopColor: "#111",
            borderRadius: "50%",
            display: "inline-block",
          }}
        />
      ) : isPlaying ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16" rx="1.2" />
          <rect x="14" y="4" width="4" height="16" rx="1.2" />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 1 }}>
          <polygon points="6 4 20 12 6 20 6 4" />
        </svg>
      )}
    </motion.button>
  );
}
