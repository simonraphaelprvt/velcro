/**
 * VELCRO Wake Word Detector
 *
 * Continuously listens via the browser's Web Speech API for the phrase
 * "Hey VELCRO" (and tolerant variants). Runs entirely client-side — no
 * audio leaves the device until a wake word fires. Zero API cost.
 *
 * Usage:
 *   const detector = new WakeWordDetector();
 *   if (detector.isSupported()) {
 *     detector.onWakeWord(() => startRecording());
 *     detector.start();
 *   }
 *
 * Lifecycle:
 *   start()  — begin listening (or resume after pause)
 *   pause()  — stop listening, do not auto-restart (use during VELCRO speech)
 *   resume() — resume after pause
 *   stop()   — fully tear down
 *
 * Browser support:
 *   - Chrome (desktop + Android): ✓
 *   - Safari (macOS + iOS 14.5+): ✓ (with special handling — see below)
 *   - Firefox: ✗ (no SpeechRecognition support)
 *
 * Safari note:
 *   SpeechRecognition.start() requires a user gesture in Safari. To work
 *   around this we NEVER call recognition.stop() in pause() — instead we
 *   keep recognition running at all times and gate the callback via a
 *   `paused` flag. If recognition ends by itself (silence / error), we
 *   re-attach a one-time pointerdown listener so the next user touch
 *   restarts it.
 */

// Minimal SpeechRecognition types — these aren't in the default DOM lib.
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
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export type WakeWordCallback = () => void;

// Tolerant variants — recognizers may transcribe differently.
// German de-DE and English en-US recognizers both handle "velcro" differently.
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
  "velcro",   // bare keyword as a forgiving last-resort match
  "welcro",   // German speech engine variant
  "belkro",
  "velkro",
];

export class WakeWordDetector {
  private recognition: SpeechRecognitionLike | null = null;
  private callback: WakeWordCallback | null = null;

  /** True when the detector wants to be listening. */
  private active = false;

  /** True while a SpeechRecognition session is live. */
  private running = false;

  /** True when paused via .pause() — callbacks are silenced. */
  private paused = false;

  /** Cooldown to prevent rapid-fire wake events from interim results. */
  private lastFireAt = 0;
  private cooldownMs = 1500;

  /**
   * True on Safari (macOS and iOS). Safari requires a user gesture to call
   * recognition.start(), so we keep recognition running continuously and
   * only gate via the paused flag rather than stopping and restarting.
   */
  private get isSafari(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    return /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);
  }

  constructor() {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    // "Hey VELCRO" is an English phrase — use en-US so the recognizer doesn't
    // mangle it. German de-DE transcribes "velcro" as "Weltco", "Belcro", etc.
    recognition.lang = "en-US";
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      this.running = true;
    };

    recognition.onresult = (e) => {
      // Always gate — whether paused explicitly or not yet active
      if (this.paused || !this.active) return;

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];

        // Collect all alternatives, not just [0]
        const transcripts: string[] = [];
        for (let a = 0; a < result.length; a++) {
          const t = result[a]?.transcript?.toLowerCase();
          if (t) transcripts.push(t);
        }
        if (!transcripts.length) continue;

        const matched = transcripts.some(
          (t) =>
            // Exact phrase variants
            WAKE_PHRASES.some((p) => t.includes(p)) ||
            // Regex: any word resembling "velcro" in any accent/spelling
            /vel[ck]r/i.test(t) ||
            /welcr/i.test(t)   ||
            /belcr/i.test(t)   ||
            /felcr/i.test(t)
        );

        if (matched) {
          const now = Date.now();
          if (now - this.lastFireAt > this.cooldownMs) {
            this.lastFireAt = now;
            this.callback?.();
          }
          return;
        }
      }
    };

    recognition.onerror = (e) => {
      // Permission errors are fatal — user must reload + grant.
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.active = false;
        return;
      }
      // 'no-speech', 'network', 'audio-capture' — just let onend handle restart
      if (e.error === "aborted") return;
    };

    recognition.onend = () => {
      this.running = false;

      if (!this.active || this.paused) return;

      if (this.isSafari) {
        // Safari: restart via short timer first — often works if the session
        // ended due to silence (not a cold start). If it throws (no gesture),
        // fall back to waiting for the next pointer event.
        setTimeout(() => {
          if (this.active && !this.paused && !this.running) {
            try {
              this.recognition!.start();
            } catch {
              // Gesture required — wait for next touch
              this.waitForGestureToRestart();
            }
          }
        }, 300);
      } else {
        // Non-Safari: safe to restart from setTimeout
        setTimeout(() => this.tryStart(), 300);
      }
    };

    this.recognition = recognition;
  }

  /** True if the browser supports SpeechRecognition at all. */
  isSupported(): boolean {
    return this.recognition !== null;
  }

  /**
   * Begin (or resume) listening for the wake word.
   * Must be called from a user gesture on Safari.
   */
  start(): void {
    if (!this.recognition) return;
    this.active = true;
    this.paused = false;
    this.tryStart();
  }

  /**
   * Pause listening (e.g. while VELCRO is recording or speaking).
   * On Safari we do NOT stop the recognition — we just mute the callback.
   * This avoids the user-gesture requirement for start() on resume.
   */
  pause(): void {
    this.paused = true;
    if (this.isSafari) {
      // Keep recognition alive — just gate via paused flag in onresult.
      return;
    }
    if (this.recognition && this.running) {
      try { this.recognition.stop(); } catch { /* ignore */ }
    }
  }

  /**
   * Resume after pause().
   * On Safari recognition is still running — just unmute the callback.
   */
  resume(): void {
    if (!this.recognition || !this.active) return;
    this.paused = false;
    if (this.isSafari) {
      // Recognition never stopped — no restart needed.
      // But if it somehow died, wait for the next user touch.
      if (!this.running) {
        this.waitForGestureToRestart();
      }
      return;
    }
    this.tryStart();
  }

  /** Tear down completely. */
  stop(): void {
    this.active = false;
    this.paused = false;
    if (this.recognition && this.running) {
      try { this.recognition.abort(); } catch { /* ignore */ }
    }
  }

  /** Register the callback fired on wake word match. */
  onWakeWord(callback: WakeWordCallback): void {
    this.callback = callback;
  }

  /** Defensive start — recognition.start() throws if already running. */
  private tryStart(): void {
    if (!this.recognition || this.running || this.paused || !this.active) return;
    try {
      this.recognition.start();
    } catch {
      // Already started or transient error — ignore
    }
  }

  /**
   * Safari-only: attach a one-shot pointerdown listener so the next
   * user touch restarts the recognition session. This is the only reliable
   * way to satisfy Safari's user-gesture requirement.
   */
  private waitForGestureToRestart(): void {
    if (typeof window === "undefined") return;
    const handler = () => {
      if (this.active && !this.paused && !this.running) {
        this.tryStart();
      }
    };
    window.addEventListener("pointerdown", handler, { once: true, passive: true });
  }
}
