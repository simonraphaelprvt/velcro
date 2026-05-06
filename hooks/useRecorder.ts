"use client";

import { useRef, useState, useCallback } from "react";

type RecorderState = "idle" | "recording";

interface UseRecorderReturn {
  state:  RecorderState;
  start:  () => Promise<void>;
  stop:   () => Promise<Blob | null>;
}

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";

  // Order matters: prefer opus/webm on Chrome/Firefox, fall back to
  // mp4/aac for Safari (macOS + iOS). Some iOS versions return false for
  // isTypeSupported even for formats they support — we rely on the empty-
  // string fallback at the end which lets the browser pick its own default.
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4;codecs=aac",  // iOS Safari primary
    "audio/mp4",              // iOS Safari fallback
    "audio/aac",              // some older iOS
  ];

  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log("[Recorder] mimeType selected:", type);
      return type;
    }
  }
  // Empty string → browser picks default. Works on iOS even when all
  // isTypeSupported() calls return false.
  console.log("[Recorder] mimeType: using browser default");
  return "";
}

export function useRecorder(): UseRecorderReturn {
  const [state, setState]   = useState<RecorderState>("idle");
  const recorderRef         = useRef<MediaRecorder | null>(null);
  const chunksRef           = useRef<Blob[]>([]);
  // Persistent stream — requested once, reused.
  // This avoids re-prompting for mic permission on every recording.
  const streamRef           = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    if (state === "recording") return;

    // ── Request mic access ──────────────────────────────────────────────
    // Must happen as close to the user gesture as possible. iOS Safari
    // breaks the gesture chain after await, so callers should NOT await
    // anything else before calling this.
    if (!streamRef.current) {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            // Prefer mono, 16-kHz-ish quality for Whisper — lower bandwidth
            channelCount:    { ideal: 1 },
            sampleRate:      { ideal: 16000 },
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        console.log("[Recorder] getUserMedia granted");
      } catch (err) {
        console.error("[Recorder] getUserMedia failed:", err);
        streamRef.current = null;
        throw err; // Propagate so startListening() can show feedback
      }
    }

    // ── Create MediaRecorder ────────────────────────────────────────────
    try {
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(
        streamRef.current,
        mimeType ? { mimeType } : undefined,
      );
      recorderRef.current = recorder;
      chunksRef.current   = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100); // collect chunks every 100 ms
      setState("recording");
      console.log("[Recorder] started, mimeType:", recorder.mimeType);
    } catch (err) {
      console.error("[Recorder] MediaRecorder init failed:", err);
      // Release stream so next call tries again
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      throw err;
    }
  }, [state]);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/mp4";
        const blob     = new Blob(chunksRef.current, { type: mimeType });
        // Keep stream alive — avoids re-permission-prompt next time
        recorderRef.current = null;
        chunksRef.current   = [];
        setState("idle");
        console.log("[Recorder] stopped, blob size:", blob.size, "type:", mimeType);
        resolve(blob.size > 0 ? blob : null);
      };

      recorder.stop();
    });
  }, []);

  return { state, start, stop };
}
