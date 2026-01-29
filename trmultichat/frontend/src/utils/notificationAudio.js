function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 1;
  return Math.max(0, Math.min(1, x));
}

function getAudioContext() {
  // eslint-disable-next-line no-undef
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  // Reuse a singleton context to reduce delays
  if (!window.__tr_audio_ctx) {
    try {
      window.__tr_audio_ctx = new Ctx();
    } catch {
      return null;
    }
  }
  return window.__tr_audio_ctx;
}

function playTone({ freq = 880, durationMs = 120, volume = 1 } = {}) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const v = clamp01(volume);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, v), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.frequency.setValueAtTime(freq, now);
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  } catch {}
}

export function playAgendaChime(volume = 1) {
  // Two-tone chime (distinct from ticket/chat mp3)
  const v = clamp01(volume) * 0.9;
  playTone({ freq: 784, durationMs: 110, volume: v });
  setTimeout(() => playTone({ freq: 1046, durationMs: 140, volume: v }), 140);
}

