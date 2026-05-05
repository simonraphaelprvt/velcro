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
  /**
   * Call this from the first user gesture (click / tap) to kick off
   * recognition on Safari, where useEffect is not a user gesture.
   */
  primeFromGesture: () => void;
}

/**
 * Manages a single WakeWordDetector instance across the page lifetime.
 *
 * The detector starts on mount (Chrome/Firefox) or on the first user gesture
 * (Safari — SpeechRecognition.start() requires a user gesture there).
 * It pauses while VELCRO is recording / thinking / speaking, and resumes
 * once status returns to idle. The onWake callback fires only when
 * status === "idle".
 */
export function useWakeWord({
  enabled,
  status,
  onWake,
}: UseWakeWordOptions): UseWakeWordReturn {
  const detectorRef    = useRef<WakeWordDetector | null>(null);
  const onWakeRef      = useRef(onWake);
  const statusRef      = useRef<VelcroStatus>(status);
  const primedRef      = useRef(false);
  // Mirror the supported state in a ref so primeFromGesture (which may be
  // captured as a stale closure in page.tsx's primer effect) can still read
  // the current value at call-time, not the value from when it was defined.
  const supportedRef   = useRef(false);

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
      if (statusRef.current === "idle") {
        onWakeRef.current();
      }
    });

    detectorRef.current = detector;
    supportedRef.current = true;
    setSupported(true);

    // Non-Safari: start immediately from the effect (works fine).
    // Safari: start() requires a user gesture — we'll start in primeFromGesture().
    const isSafari = /Safari/.test(navigator.userAgent) &&
                     !/Chrome/.test(navigator.userAgent) &&
                     !/CriOS/.test(navigator.userAgent);

    if (!isSafari) {
      detector.start();
      setListening(true);
    }
    // On Safari the indicator stays dark until the first touch primes it.

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

  // ── primeFromGesture — call from first user touch ─────────────────────
  // IMPORTANT: this function is captured as a closure in page.tsx's primer
  // effect and may be stale. We deliberately use refs (not state) here so
  // the call always reads current values regardless of when it was captured.
  const primeFromGesture = () => {
    if (primedRef.current) return;
    primedRef.current = true;

    const detector = detectorRef.current;
    // Use supportedRef (not the `supported` state variable) — the state may
    // be stale in the closure captured by page.tsx's primer event listener.
    if (!detector || !supportedRef.current) return;

    // Only needed on Safari — detector.start() is a no-op if already running
    if (statusRef.current === "idle") {
      detector.start();
      setListening(true);
    }
  };

  return { supported, listening, primeFromGesture };
}
