/**
 * VELCRO Wake Word Detector — v2 (reliable)
 *
 * Key changes from v1:
 *  - No browser-specific code paths — all browsers treated the same
 *  - start() must be called from a user gesture (page.tsx primer handles this)
 *  - Watchdog timer: if running should be true but isn't, restart
 *  - Never permanently disables on errors — exponential back-off instead
 *  - Console logging so you can actually see what's happening
 *  - pause/resume both stop/start recognition (no gating flag hack)
 */

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    [index: number]: { transcript: string; confidence: number };
    length: number;
  }>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

interface SpeechRecognitionLike {
  continuous:       boolean;
  interimResults:   boolean;
  lang:             string;
  maxAlternatives?: number;
  onresult:  ((e: SpeechRecognitionEventLike) => void)      | null;
  onerror:   ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend:     (() => void) | null;
  onstart:   (() => void) | null;
  start: () => void;
  stop:  () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?:        SpeechRecognitionCtor;
    webkitSpeechRecognition?:  SpeechRecognitionCtor;
  }
}

export type WakeWordCallback = () => void;

// Tolerant phrase variants — covers mis-transcriptions across accents / languages
const WAKE_PHRASES = [
  "hey velcro",
  "hey velco",
  "hey wellcro",
  "hey velcrow",
  "hey velcros",
  "hey belcro",
  "hey feltro",
  "hi velcro",
  "ok velcro",
  "okay velcro",
  "velcro",
  "welcro",
  "belkro",
  "velkro",
];

export class WakeWordDetector {
  private recognition: SpeechRecognitionLike | null = null;
  private callback:    WakeWordCallback | null = null;

  /** Should be listening (set by start/stop). */
  private active  = false;
  /** Is a recognition session currently live. */
  private running = false;
  /** Temporarily muted while VELCRO is speaking/thinking. */
  private paused  = false;

  private lastFireAt  = 0;
  private cooldownMs  = 1500;
  private errorCount  = 0;

  private watchdogTimer: ReturnType<typeof setInterval>  | null = null;
  private restartTimer:  ReturnType<typeof setTimeout>   | null = null;

  constructor() {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.continuous      = true;
    rec.interimResults  = true;
    // en-US: "Hey VELCRO" is clearest in English — other langs mangle it
    rec.lang            = "en-US";
    rec.maxAlternatives = 3;

    rec.onstart = () => {
      this.running    = true;
      this.errorCount = 0;
      console.log("[WakeWord] ▶ started");
    };

    rec.onresult = (e) => {
      if (this.paused || !this.active) return;

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcripts: string[] = [];
        for (let a = 0; a < result.length; a++) {
          const t = result[a]?.transcript?.toLowerCase();
          if (t) transcripts.push(t);
        }
        if (!transcripts.length) continue;

        const matched = transcripts.some(
          (t) =>
            WAKE_PHRASES.some((p) => t.includes(p)) ||
            /vel[ck]r/i.test(t)  ||
            /welcr/i.test(t)     ||
            /belcr/i.test(t)     ||
            /felcr/i.test(t)
        );

        if (matched) {
          const now = Date.now();
          if (now - this.lastFireAt > this.cooldownMs) {
            console.log("[WakeWord] 🎤 wake detected:", transcripts[0]);
            this.lastFireAt = now;
            this.callback?.();
          }
          return;
        }
      }
    };

    rec.onerror = (e) => {
      console.warn("[WakeWord] ⚠ error:", e.error, e.message ?? "");
      this.errorCount++;

      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        // Mic permission denied — don't permanently die.
        // The watchdog will retry; user can re-grant permission in browser.
        console.error("[WakeWord] mic permission denied — will retry on next gesture");
        this.running = false;
        return;
      }
      // 'aborted' is expected when we call .stop() manually
      if (e.error === "aborted") {
        this.running = false;
        return;
      }
      // 'no-speech', 'network', 'audio-capture' — let onend handle restart
    };

    rec.onend = () => {
      this.running = false;
      console.log("[WakeWord] ■ ended  active=%s paused=%s", this.active, this.paused);

      if (!this.active || this.paused) return;

      // Exponential back-off: 300 ms → 450 → 675 → … capped at 8 s
      const delay = Math.min(300 * Math.pow(1.5, Math.min(this.errorCount, 6)), 8000);
      this.scheduleRestart(delay);
    };

    this.recognition = rec;

    // Watchdog: if we should be running but aren't, kick it again
    this.watchdogTimer = setInterval(() => {
      if (this.active && !this.paused && !this.running) {
        console.log("[WakeWord] 🐕 watchdog restart");
        this.tryStart();
      }
    }, 5000);
  }

  isSupported(): boolean {
    return this.recognition !== null;
  }

  /**
   * Begin listening. Must be called from a user gesture on all browsers.
   */
  start(): void {
    if (!this.recognition) return;
    this.active = true;
    this.paused = false;
    this.tryStart();
  }

  /**
   * Pause while VELCRO is active. Stops recognition so the mic indicator
   * disappears. Resume() restarts it.
   */
  pause(): void {
    if (!this.recognition) return;
    this.paused = true;
    if (this.running) {
      try { this.recognition.stop(); } catch { /* ignore */ }
    }
  }

  /** Resume after pause(). */
  resume(): void {
    if (!this.recognition || !this.active) return;
    this.paused = false;
    this.tryStart();
  }

  /** Full teardown. */
  stop(): void {
    this.active = false;
    this.paused = false;

    if (this.watchdogTimer) { clearInterval(this.watchdogTimer); this.watchdogTimer = null; }
    if (this.restartTimer)  { clearTimeout(this.restartTimer);   this.restartTimer  = null; }

    if (this.recognition && this.running) {
      try { this.recognition.abort(); } catch { /* ignore */ }
    }
  }

  onWakeWord(callback: WakeWordCallback): void {
    this.callback = callback;
  }

  private tryStart(): void {
    if (!this.recognition || this.running || this.paused || !this.active) return;
    try {
      this.recognition.start();
    } catch (err) {
      console.warn("[WakeWord] start() threw:", err);
    }
  }

  private scheduleRestart(delay: number): void {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.tryStart();
    }, delay);
  }
}
