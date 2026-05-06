"use client";

import { useEffect, useRef, useState } from "react";
import { WakeWordDetector } from "@/lib/wakeWord";
import type { VelcroStatus } from "@/hooks/useVelcro";

interface UseWakeWordOptions {
  enabled:  boolean;
  status:   VelcroStatus;
  onWake:   () => void;
}

interface UseWakeWordReturn {
  supported:        boolean;
  listening:        boolean;
  primeFromGesture: () => void;
}

/**
 * Manages a single WakeWordDetector across the page lifetime.
 *
 * Design:
 *  - Detector is created on mount but NOT started automatically.
 *  - primeFromGesture() must be called from a real user interaction (click/key).
 *    This satisfies Chrome's (and Safari's) user-gesture requirement for
 *    SpeechRecognition.start().
 *  - While status !== "idle" the detector is paused so VELCRO's own mic
 *    doesn't clash with wake-word recognition.
 *  - The WakeWordDetector itself has a watchdog that restarts on failure.
 */
export function useWakeWord({
  enabled,
  status,
  onWake,
}: UseWakeWordOptions): UseWakeWordReturn {
  const detectorRef  = useRef<WakeWordDetector | null>(null);
  const onWakeRef    = useRef(onWake);
  const statusRef    = useRef<VelcroStatus>(status);
  const primedRef    = useRef(false);
  const supportedRef = useRef(false);       // avoids stale-closure in primeFromGesture

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => { onWakeRef.current = onWake; }, [onWake]);
  useEffect(() => { statusRef.current = status; }, [status]);

  // ── Create detector once on mount ───────────────────────────────────────
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

    detectorRef.current  = detector;
    supportedRef.current = true;
    setSupported(true);

    // ⚠️  DO NOT call detector.start() here.
    //     SpeechRecognition.start() silently fails (or throws) on Chrome and
    //     Safari if called outside a user gesture. The primer in page.tsx will
    //     call primeFromGesture() on the first click/tap/keypress.

    return () => {
      detector.stop();
      detectorRef.current = null;
      setListening(false);
    };
  }, [enabled]);

  // ── Pause / resume around active states ────────────────────────────────
  useEffect(() => {
    const detector = detectorRef.current;
    if (!detector || !supported) return;

    if (status === "idle") {
      if (primedRef.current) {
        // Only resume if we've already been started via a user gesture
        detector.resume();
        setListening(true);
      }
    } else {
      detector.pause();
      setListening(false);
    }
  }, [status, supported]);

  // ── primeFromGesture ────────────────────────────────────────────────────
  // Called once from page.tsx on first pointerdown / keydown.
  // Uses refs so the captured closure in page.tsx's primer is never stale.
  const primeFromGesture = () => {
    if (primedRef.current) return;
    primedRef.current = true;

    const detector = detectorRef.current;
    if (!detector || !supportedRef.current) return;

    if (statusRef.current === "idle") {
      detector.start();
      setListening(true);
    }
    // If not idle right now, the status → idle transition above will call resume()
  };

  return { supported, listening, primeFromGesture };
}
