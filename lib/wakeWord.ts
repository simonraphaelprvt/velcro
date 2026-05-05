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
 *   stop()   — fully tear down
 *
 * Browser support:
 *   - Chrome (desktop + Android): ✓
 *   - Safari (macOS + iPad iOS 14.5+): ✓
 *   - Firefox: ✗ (no SpeechRecognition support)
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

// Tolerant variants — Whisper-like recognizers may transcribe differently.
const WAKE_PHRASES = [
  "hey velcro",
  "hey velco",
  "hey wellcro",
  "hey velcrow",
  "hi velcro",
  "ok velcro",
  "velcro",   // bare keyword as a forgiving last-resort match
];

export class WakeWordDetector {
  private recognition: SpeechRecognitionLike | null = null;
  private callback: WakeWordCallback | null = null;

  /** True when the detector wants to be listening. */
  private active = false;

  /** True while a SpeechRecognition session is live. */
  private running = false;

  /** True when paused via .pause() — won't auto-restart on .onend(). */
  private paused = false;

  /** Cooldown to prevent rapid-fire wake events from interim results. */
  private lastFireAt = 0;
  private cooldownMs = 1500;

  constructor() {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "de-DE";
    recognition.maxAlternatives = 2;

    recognition.onstart = () => {
      this.running = true;
    };

    recognition.onresult = (e) => {
      if (this.paused) return;

      // Walk through all new results since resultIndex
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0]?.transcript?.toLowerCase() ?? "";
        if (!transcript) continue;

        if (WAKE_PHRASES.some((p) => transcript.includes(p))) {
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
      // 'no-speech' and 'network' just mean restart in onend
      if (e.error === "aborted") return;
    };

    recognition.onend = () => {
      this.running = false;
      // Auto-restart if we're still meant to be listening
      if (this.active && !this.paused) {
        // Small backoff to avoid hammering the engine
        setTimeout(() => this.tryStart(), 300);
      }
    };

    this.recognition = recognition;
  }

  /** True if the browser supports SpeechRecognition at all. */
  isSupported(): boolean {
    return this.recognition !== null;
  }

  /** Begin (or resume) listening for the wake word. */
  start(): void {
    if (!this.recognition) return;
    this.active = true;
    this.paused = false;
    this.tryStart();
  }

  /**
   * Pause listening (e.g. while VELCRO is recording or speaking).
   * Won't auto-restart — call resume() when ready.
   */
  pause(): void {
    this.paused = true;
    if (this.recognition && this.running) {
      try { this.recognition.stop(); } catch { /* ignore */ }
    }
  }

  /** Resume after pause(). No-op if never started. */
  resume(): void {
    if (!this.recognition || !this.active) return;
    this.paused = false;
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
    if (!this.recognition || this.running || this.paused) return;
    try {
      this.recognition.start();
    } catch {
      // Already started or transient error — ignore
    }
  }
}
