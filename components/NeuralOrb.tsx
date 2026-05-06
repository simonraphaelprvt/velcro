"use client";

import { useEffect, useRef } from "react";
import type { VelcroStatus } from "@/hooks/useVelcro";

interface NeuralOrbProps {
  className?: string;
  status?: VelcroStatus;
  analyserNode?: AnalyserNode | null;
  onClick?: () => void;
}

export default function NeuralOrb({
  className,
  status = "idle",
  analyserNode,
  onClick,
}: NeuralOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef<number>(0);

  const isIdle      = status === "idle";
  const isRecording = status === "recording";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Dynamic Three.js import (client-only) ─────────────────────────
    let cancelled = false;

    (async () => {
      const THREE = await import("three");

      if (cancelled) return;

      // ── Renderer ─────────────────────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);

      // ── Scene / Camera ───────────────────────────────────────────────
      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.z = 7;

      // ── Helper: seeded pseudo-random (stable across hot-reloads) ─────
      let seed = 42;
      const rng = () => {
        seed = (seed * 1664525 + 1013904223) & 0xffffffff;
        return (seed >>> 0) / 0xffffffff;
      };

      // ── 200 sphere-surface nodes ──────────────────────────────────────
      const NODE_COUNT       = 200;
      const SPHERE_RADIUS    = 2.8;
      const CONNECTION_DIST  = 1.5;

      const nodePos  = new Float32Array(NODE_COUNT * 3);
      const nodeVel  = new Float32Array(NODE_COUNT * 3); // drift velocity

      for (let i = 0; i < NODE_COUNT; i++) {
        // Uniform sphere-surface distribution (Marsaglia method)
        let x: number, y: number, z: number, d: number;
        do {
          x = rng() * 2 - 1;
          y = rng() * 2 - 1;
          z = rng() * 2 - 1;
          d = x * x + y * y + z * z;
        } while (d > 1 || d < 0.001);
        const scale = SPHERE_RADIUS * (0.85 + rng() * 0.22) / Math.sqrt(d);
        nodePos[i * 3]     = x * scale;
        nodePos[i * 3 + 1] = y * scale;
        nodePos[i * 3 + 2] = z * scale;
        // Random drift
        const spd = 0.003 + rng() * 0.002;
        nodeVel[i * 3]     = (rng() - 0.5) * spd;
        nodeVel[i * 3 + 1] = (rng() - 0.5) * spd;
        nodeVel[i * 3 + 2] = (rng() - 0.5) * spd;
      }

      // Node points mesh
      const nodeGeo = new THREE.BufferGeometry();
      nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodePos.slice(), 3));
      const nodeMat = new THREE.PointsMaterial({
        size:  0.07,
        color: 0xc4b0ff,
        transparent: true,
        opacity: 0.95,
        sizeAttenuation: true,
      });
      const nodePoints = new THREE.Points(nodeGeo, nodeMat);
      nodePoints.frustumCulled = false;

      // ── Connection lines (pre-build; rebuilt when nodes move) ─────────
      // We keep a static line geometry that we update in the animate loop.
      // Max possible lines: 200*199/2 = 19900. We allocate for 6000 (typical).
      const MAX_SEGS = 6000;
      const linePositions = new Float32Array(MAX_SEGS * 6); // 2 verts × 3 floats
      const lineGeo = new THREE.BufferGeometry();
      const linePosAttr = new THREE.BufferAttribute(linePositions, 3);
      linePosAttr.setUsage(THREE.DynamicDrawUsage);
      lineGeo.setAttribute("position", linePosAttr);
      const linesMat = new THREE.LineBasicMaterial({
        color: 0x8b6fe8,
        transparent: true,
        opacity: 0.5,
      });
      const lines = new THREE.LineSegments(lineGeo, linesMat);
      lines.frustumCulled = false;

      // ── 80 free-floating outer particles ─────────────────────────────
      const FLOAT_COUNT   = 80;
      const floatPos  = new Float32Array(FLOAT_COUNT * 3);
      const floatVel  = new Float32Array(FLOAT_COUNT * 3);

      for (let i = 0; i < FLOAT_COUNT; i++) {
        const r   = 3.0 + rng() * 0.7; // radius 3.0–3.7, fits within z=7 FOV60 frustum (±4.04)
        let x: number, y: number, z: number, d: number;
        do {
          x = rng() * 2 - 1;
          y = rng() * 2 - 1;
          z = rng() * 2 - 1;
          d = x * x + y * y + z * z;
        } while (d > 1 || d < 0.001);
        const scale = r / Math.sqrt(d);
        floatPos[i * 3]     = x * scale;
        floatPos[i * 3 + 1] = y * scale;
        floatPos[i * 3 + 2] = z * scale;
        const spd = 0.002 + rng() * 0.003;
        floatVel[i * 3]     = (rng() - 0.5) * spd;
        floatVel[i * 3 + 1] = (rng() - 0.5) * spd;
        floatVel[i * 3 + 2] = (rng() - 0.5) * spd;
      }

      const floatGeo = new THREE.BufferGeometry();
      floatGeo.setAttribute("position", new THREE.BufferAttribute(floatPos.slice(), 3));
      const floatMat = new THREE.PointsMaterial({
        size:  0.03,
        color: 0xe0d8ff,
        transparent: true,
        opacity: 0.7,
        sizeAttenuation: true,
      });
      const floatPoints = new THREE.Points(floatGeo, floatMat);
      floatPoints.frustumCulled = false;

      // ── Group (everything rotates together) ───────────────────────────
      const group = new THREE.Group();
      group.add(nodePoints);
      group.add(lines);
      group.add(floatPoints);
      scene.add(group);

      // ── Responsive resize ─────────────────────────────────────────────
      // Use the canvas's own CSS size — don't trust the parent's clientHeight
      // which can be stale or include non-canvas children.
      const CANVAS_SIZE = 380;
      const resize = () => {
        renderer.setSize(CANVAS_SIZE, CANVAS_SIZE, false);
        camera.aspect = 1;
        camera.updateProjectionMatrix();
      };
      resize();
      // No ResizeObserver needed — canvas is always square at CANVAS_SIZE

      // ── Audio analyser data ────────────────────────────────────────────
      const audioData = new Uint8Array(32);
      let audioScale  = 1;

      // ── Animation loop ────────────────────────────────────────────────
      const clock = new THREE.Clock();

      const animate = () => {
        if (cancelled) return;
        frameRef.current = requestAnimationFrame(animate);

        const t = clock.getElapsedTime();

        // Audio-reactive scale (only while speaking)
        const liveAnalyser = (window as unknown as { __velcroAnalyser?: AnalyserNode }).__velcroAnalyser;
        if (liveAnalyser) {
          liveAnalyser.getByteFrequencyData(audioData);
          const raw = audioData.reduce((a, b) => a + b, 0) / audioData.length / 255;
          audioScale = audioScale * 0.85 + (1 + raw * 0.4) * 0.15;
        } else {
          audioScale = audioScale * 0.95 + 1 * 0.05;
        }

        // Rotate group
        group.rotation.y += 0.002;
        group.rotation.x  = Math.sin(t * 0.15) * 0.2;
        group.scale.setScalar(audioScale);

        // Move nodes (drift + soft sphere constraint)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nodePosAttr = nodeGeo.attributes.position as any;
        const updatedPos = nodePosAttr.array as Float32Array;
        for (let i = 0; i < NODE_COUNT; i++) {
          const ix = i * 3, iy = ix + 1, iz = ix + 2;
          updatedPos[ix] += nodeVel[ix];
          updatedPos[iy] += nodeVel[iy];
          updatedPos[iz] += nodeVel[iz];

          // Soft bounce back toward sphere surface
          const dist = Math.sqrt(
            updatedPos[ix] ** 2 + updatedPos[iy] ** 2 + updatedPos[iz] ** 2
          );
          const target = SPHERE_RADIUS * (0.85 + Math.sin(t * 0.3 + i * 0.5) * 0.07);
          if (Math.abs(dist - target) > 0.3) {
            const pull = 0.0015 * (dist - target) / dist;
            nodeVel[ix] -= updatedPos[ix] * pull;
            nodeVel[iy] -= updatedPos[iy] * pull;
            nodeVel[iz] -= updatedPos[iz] * pull;
          }
        }
        nodePosAttr.needsUpdate = true;

        // Rebuild connections
        let segCount = 0;
        for (let a = 0; a < NODE_COUNT && segCount < MAX_SEGS - 1; a++) {
          const ax = updatedPos[a * 3], ay = updatedPos[a * 3 + 1], az = updatedPos[a * 3 + 2];
          for (let b = a + 1; b < NODE_COUNT && segCount < MAX_SEGS - 1; b++) {
            const dx = ax - updatedPos[b * 3];
            const dy = ay - updatedPos[b * 3 + 1];
            const dz = az - updatedPos[b * 3 + 2];
            if (dx * dx + dy * dy + dz * dz < CONNECTION_DIST * CONNECTION_DIST) {
              const s = segCount * 6;
              linePositions[s]     = ax;
              linePositions[s + 1] = ay;
              linePositions[s + 2] = az;
              linePositions[s + 3] = updatedPos[b * 3];
              linePositions[s + 4] = updatedPos[b * 3 + 1];
              linePositions[s + 5] = updatedPos[b * 3 + 2];
              segCount++;
            }
          }
        }
        linePosAttr.needsUpdate = true;
        lineGeo.setDrawRange(0, segCount * 2);

        // Move floating particles
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const floatPosAttr = floatGeo.attributes.position as any;
        const fp = floatPosAttr.array as Float32Array;
        for (let i = 0; i < FLOAT_COUNT; i++) {
          const ix = i * 3, iy = ix + 1, iz = ix + 2;
          fp[ix] += floatVel[ix];
          fp[iy] += floatVel[iy];
          fp[iz] += floatVel[iz];
          const dist = Math.sqrt(fp[ix] ** 2 + fp[iy] ** 2 + fp[iz] ** 2);
          if (dist > 3.9 || dist < 2.8) {
            floatVel[ix] *= -1;
            floatVel[iy] *= -1;
            floatVel[iz] *= -1;
          }
        }
        floatPosAttr.needsUpdate = true;

        renderer.render(scene, camera);
      };

      animate();

      // ── Cleanup ───────────────────────────────────────────────────────
      return () => {
        cancelled = true;
        cancelAnimationFrame(frameRef.current);
        ro.disconnect();
        renderer.dispose();
        nodeGeo.dispose();
        nodeMat.dispose();
        lineGeo.dispose();
        linesMat.dispose();
        floatGeo.dispose();
        floatMat.dispose();
      };
    })().then((cleanup) => {
      if (cancelled && cleanup) cleanup();
      // Store cleanup for the outer effect return
      (canvasRef as unknown as { __cleanup?: () => void }).__cleanup = cleanup;
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameRef.current);
      const c = (canvasRef as unknown as { __cleanup?: () => void }).__cleanup;
      if (c) c();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expose analyserNode on window so the animation loop can read it
  useEffect(() => {
    (window as unknown as { __velcroAnalyser?: AnalyserNode | null }).__velcroAnalyser =
      analyserNode ?? null;
  }, [analyserNode]);

  return (
    <button
      onClick={(isIdle || isRecording) ? onClick : undefined}
      aria-label={isIdle ? "Sprechen" : isRecording ? "Aufnahme beenden" : undefined}
      className={[
        "group relative flex items-center justify-center select-none outline-none",
        (isIdle || isRecording) ? "cursor-pointer" : "cursor-default",
        className ?? "",
      ].join(" ")}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Status glow ring behind canvas */}
      <div
        className="pointer-events-none absolute rounded-full transition-all duration-700"
        style={{
          width: "340px",
          height: "340px",
          background:
            isRecording
              ? "radial-gradient(circle, rgba(139,92,246,0.55) 0%, transparent 65%)"
              : status === "speaking"
              ? "radial-gradient(circle, rgba(99,102,241,0.65) 0%, transparent 65%)"
              : status === "thinking" || status === "transcribing"
              ? "radial-gradient(circle, rgba(129,140,248,0.35) 0%, transparent 65%)"
              : "radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 65%)",
          filter: "blur(24px)",
        }}
      />

      {/* Three.js canvas — 380×380 so sphere never clips at edges */}
      <canvas
        ref={canvasRef}
        style={{ width: "380px", height: "380px", display: "block" }}
      />

      {/* VELCRO wordmark overlay */}
      <span
        className="pointer-events-none absolute text-[13px] font-light tracking-[0.55em] text-white/70 transition-opacity duration-500"
        style={{
          letterSpacing: "0.55em",
          opacity: status === "thinking" || status === "transcribing" ? 0.35 : 0.7,
        }}
      >
        VELCRO
      </span>

      {/* Status hints */}
      {isIdle && (
        <span className="animate-fade-in absolute -bottom-8 text-[10px] tracking-[0.45em] text-velcro-dim transition-opacity duration-300 group-hover:opacity-0">
          SPACE
        </span>
      )}
      {isRecording && (
        <span className="animate-fade-in absolute -bottom-8 text-[10px] tracking-[0.3em] text-velcro-accent">
          ● REC
        </span>
      )}
    </button>
  );
}
