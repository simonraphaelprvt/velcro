"use client";

import { useEffect, useRef, useState } from "react";
import { WakeWordDetector } from "@/lib/wakeWord";
import type { VelcroStatus } from "@/hooks/useVelcro";

interface UseWakeWordOptions {
  /** Master enable switch — feature flag */
  enabled: boolean;
  /** Current pipeline status — detector pauses when not idle */
  status: VelcroStatus;
  /** Fired when a wake word is detected (only while idle) */
  onWake: () => void;
}

interface UseWakeWordReturn {
  /** True if the browser supports SpeechRecognition at all */
  supported: boolean;
  /** True while the detector is actively listening for the wake word */
  listening: boolean;
}

/**
 * Manages a single WakeWordDetector instance across the page lifetime.
 *
 * The detector starts on mount, pauses while VELCRO is recording / thinking
 * / speaking, and resumes once status returns to idle. The onWake callback
 * fires only when status === "idle" (defensive — also handled inside).
 */
export function useWakeWord({
  enabled,
  status,
  onWake,
}: UseWakeWordOptions): UseWakeWordReturn {
  const detectorRef = useRef<WakeWordDetector | null>(null);
  const onWakeRef   = useRef(onWake);
  const statusRef   = useRef<VelcroStatus>(status);

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);

  // Keep refs current — avoids re-creating the detector on each render
  useEffect(() => { onWakeRef.current = onWake; }, [onWake]);
  useEffect(() => { statusRef.current = status; }, [status]);

  // ── Create detector once on mount ────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const detector = new WakeWordDetector();
    if (!detector.isSupported()) return;

    detector.onWakeWord(() => {
      // Only fire if VELCRO is actually idle — defensive guard
      if (statusRef.current === "idle") {
        onWakeRef.current();
      }
    });

    detectorRef.current = detector;
    setSupported(true);

    // Best-effort start — may need a user gesture on iPad Safari
    detector.start();
    setListening(true);

    return () => {
      detector.stop();
      detectorRef.current = null;
      setListening(false);
    };
  }, [enabled]);

  // ── Pause / resume detector around active states ─────────────────────
  useEffect(() => {
    const detector = detectorRef.current;
    if (!detector || !supported) return;

    if (status === "idle") {
      detector.resume();
      setListening(true);
    } else {
      detector.pause();
      setListening(false);
    }
  }, [status, supported]);

  return { supported, listening };
}
