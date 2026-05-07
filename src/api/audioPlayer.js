// Singleton HTMLAudioElement shared across the app.
// One <audio> instance + a Set of subscribers — every component using
// `useAudioPlayer()` gets the same state. Switching to a new src auto-pauses
// the previous, so "only one audio plays at a time" is enforced by the engine.
//
// No base64 / data: handling — sources MUST be real URLs (PB-served or any
// http(s)). Defensive against environments where Audio() can't construct.
import React from "react";

let _audioEl = null;
try { _audioEl = typeof Audio !== "undefined" ? new Audio() : null; } catch { _audioEl = null; }
if (_audioEl) {
  _audioEl.preload = "metadata";
  _audioEl.volume = 1;
}

const _state = {
  isPlaying: false,
  isLoading: false,
  duration: 0,
  currentTime: 0,
  error: false,
  currentSrc: null,
};
const _listeners = new Set();
const _notify = () => { for (const fn of _listeners) fn(); };

if (_audioEl) {
  _audioEl.addEventListener("loadstart", () => {
    _state.isLoading = true; _state.error = false; _notify();
  });
  _audioEl.addEventListener("canplay", () => {
    _state.isLoading = false; _notify();
  });
  _audioEl.addEventListener("loadedmetadata", () => {
    _state.duration = Number.isFinite(_audioEl.duration) ? _audioEl.duration : 0;
    _state.isLoading = false;
    _notify();
  });
  _audioEl.addEventListener("play", () => {
    _state.isPlaying = true; _state.error = false; _notify();
  });
  _audioEl.addEventListener("pause", () => {
    _state.isPlaying = false; _notify();
  });
  _audioEl.addEventListener("timeupdate", () => {
    _state.currentTime = _audioEl.currentTime || 0; _notify();
  });
  _audioEl.addEventListener("ended", () => {
    _state.isPlaying = false;
    _state.currentTime = 0;
    _notify();
  });
  _audioEl.addEventListener("error", () => {
    _state.error = true;
    _state.isPlaying = false;
    _state.isLoading = false;
    _notify();
  });
}

export function audioPlayerPlay(src) {
  if (!_audioEl || !src) return;
  if (_state.currentSrc !== src) {
    _state.currentSrc = src;
    _state.currentTime = 0;
    _state.duration = 0;
    _state.error = false;
    _state.isLoading = true;
    try { _audioEl.src = src; _audioEl.load(); } catch { _state.error = true; _state.isLoading = false; }
    _notify();
  }
  // Premium fade-in: 0 → 1 across ~200ms.
  try { _audioEl.volume = 0; } catch {}
  const playPromise = _audioEl.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      _state.error = true;
      _state.isPlaying = false;
      _state.isLoading = false;
      _notify();
    });
  }
  let v = 0;
  const fade = setInterval(() => {
    v = Math.min(1, v + 0.1);
    try { _audioEl.volume = v; } catch {}
    if (v >= 1) clearInterval(fade);
  }, 20);
}

export function audioPlayerPause() {
  if (!_audioEl) return;
  try { _audioEl.pause(); } catch {}
}

export function audioPlayerToggle(src) {
  if (!_audioEl || !src) return;
  if (_state.isPlaying && _state.currentSrc === src) {
    audioPlayerPause();
  } else {
    audioPlayerPlay(src);
  }
}

export function audioPlayerSeek(t) {
  if (!_audioEl) return;
  try { _audioEl.currentTime = Math.max(0, Math.min(_state.duration || 0, t)); } catch {}
}

export function useAudioPlayer() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => {
    _listeners.add(force);
    return () => { _listeners.delete(force); };
  }, []);
  return {
    isPlaying: _state.isPlaying,
    isLoading: _state.isLoading,
    duration: _state.duration,
    currentTime: _state.currentTime,
    error: _state.error,
    currentSrc: _state.currentSrc,
    play: audioPlayerPlay,
    pause: audioPlayerPause,
    toggle: audioPlayerToggle,
    seek: audioPlayerSeek,
  };
}
