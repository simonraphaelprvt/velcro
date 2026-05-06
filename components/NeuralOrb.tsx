"use client";

import { useEffect, useRef } from "react";
import type { VelcroStatus } from "@/hooks/useVelcro";

interface NeuralOrbProps {
  className?: string;
  status?: VelcroStatus;
  analyserNode?: AnalyserNode | null;
  onClick?: () => void;
}

// ─── 2-D Perlin Noise ────────────────────────────────────────────────────────
// Returns values in roughly [-0.7, 0.7]. Seeded permutation table for
// stable, non-repeating organic motion.
function makeNoise2D(seed: number) {
  const perm = new Uint8Array(512);
  const base = Array.from({ length: 256 }, (_, i) => i);
  let s = seed | 0;
  for (let i = 255; i > 0; i--) {
    s = Math.imul(s, 1664525) + 1013904223;
    const j = ((s >>> 0) % (i + 1));
    const tmp = base[i]; base[i] = base[j]; base[j] = tmp;
  }
  for (let i = 0; i < 256; i++) perm[i] = perm[i + 256] = base[i];

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp  = (a: number, b: number, t: number) => a + t * (b - a);
  const grad  = (h: number, x: number, y: number) => {
    switch (h & 3) {
      case 0: return  x + y;
      case 1: return -x + y;
      case 2: return  x - y;
      default: return -x - y;
    }
  };

  return (x: number, y: number): number => {
    const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x),   yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = perm[perm[xi]     + yi];
    const ab = perm[perm[xi]     + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];
    return lerp(
      lerp(grad(aa, xf,     yf    ), grad(ba, xf - 1, yf    ), u),
      lerp(grad(ab, xf,     yf - 1), grad(bb, xf - 1, yf - 1), u),
      v
    );
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function NeuralOrb({
  className,
  status = "idle",
  analyserNode,
  onClick,
}: NeuralOrbProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const frameRef     = useRef<number>(0);
  const statusRef    = useRef<VelcroStatus>(status);
  const analyserRef  = useRef<AnalyserNode | null>(analyserNode ?? null);

  // Keep refs current every render so the animation loop always reads fresh values
  useEffect(() => { statusRef.current   = status; },   [status]);
  useEffect(() => { analyserRef.current = analyserNode ?? null; }, [analyserNode]);

  const isIdle      = status === "idle";
  const isRecording = status === "recording";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled  = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    (async () => {
      const THREE = await import("three");
      if (cancelled) return;

      // ── Renderer / Scene / Camera ──────────────────────────────────────
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(500, 500, false);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.z = 9.21; // 7 × (500/380) — same px/world-unit, frustum half ≥ 5.3 units

      // ── Noise functions ────────────────────────────────────────────────
      const noisePos  = makeNoise2D(42);   // group position drift
      const noiseNode = makeNoise2D(137);  // per-node surface noise

      // ── Seeded RNG for stable initial layout ───────────────────────────
      let seed = 42;
      const rng = () => {
        seed = Math.imul(seed, 1664525) + 1013904223;
        return (seed >>> 0) / 0xffffffff;
      };

      // ── Node geometry ──────────────────────────────────────────────────
      const NODE_COUNT      = 200;
      const BASE_RADIUS     = 2.8;
      const CONNECTION_DIST = 1.5;

      // nodePos: actual physics positions
      const nodePos = new Float32Array(NODE_COUNT * 3);
      const nodeVel = new Float32Array(NODE_COUNT * 3);
      // nodeDisplay: lagged display positions for edge secondary motion
      const nodeDisplay    = new Float32Array(NODE_COUNT * 3);
      const nodeDisplayVel = new Float32Array(NODE_COUNT * 3);
      // per-node noise phase offsets (never repeats across nodes)
      const nodeNoiseOff = new Float32Array(NODE_COUNT * 2);

      for (let i = 0; i < NODE_COUNT; i++) {
        let x: number, y: number, z: number, d: number;
        do {
          x = rng() * 2 - 1; y = rng() * 2 - 1; z = rng() * 2 - 1;
          d = x * x + y * y + z * z;
        } while (d > 1 || d < 0.001);
        const r = BASE_RADIUS * (0.85 + rng() * 0.22) / Math.sqrt(d);
        nodePos[i * 3]     = nodeDisplay[i * 3]     = x * r;
        nodePos[i * 3 + 1] = nodeDisplay[i * 3 + 1] = y * r;
        nodePos[i * 3 + 2] = nodeDisplay[i * 3 + 2] = z * r;
        const spd = 0.003 + rng() * 0.002;
        nodeVel[i * 3]     = (rng() - 0.5) * spd;
        nodeVel[i * 3 + 1] = (rng() - 0.5) * spd;
        nodeVel[i * 3 + 2] = (rng() - 0.5) * spd;
        nodeNoiseOff[i * 2]     = rng() * 100;
        nodeNoiseOff[i * 2 + 1] = rng() * 100;
      }

      const nodeGeo = new THREE.BufferGeometry();
      nodeGeo.setAttribute("position", new THREE.BufferAttribute(nodePos.slice(), 3));
      const nodeMat = new THREE.PointsMaterial({
        size: 0.08, color: 0xc4b0ff,
        transparent: true, opacity: 0.95, sizeAttenuation: true,
      });
      const nodePoints = new THREE.Points(nodeGeo, nodeMat);
      nodePoints.frustumCulled = false;

      // ── Line geometry with vertex colours for edge flash ───────────────
      const MAX_SEGS      = 6000;
      const linePos       = new Float32Array(MAX_SEGS * 6);
      const lineCol       = new Float32Array(MAX_SEGS * 6); // RGB per vertex
      const lineGeo       = new THREE.BufferGeometry();
      const linePosAttr   = new THREE.BufferAttribute(linePos, 3);
      const lineColAttr   = new THREE.BufferAttribute(lineCol, 3);
      linePosAttr.setUsage(THREE.DynamicDrawUsage);
      lineColAttr.setUsage(THREE.DynamicDrawUsage);
      lineGeo.setAttribute("position", linePosAttr);
      lineGeo.setAttribute("color",    lineColAttr);
      const linesMat = new THREE.LineBasicMaterial({
        transparent: true, opacity: 0.45, vertexColors: true,
      });
      const lines = new THREE.LineSegments(lineGeo, linesMat);
      lines.frustumCulled = false;

      // ── Float particles ────────────────────────────────────────────────
      const FLOAT_COUNT = 80;
      const floatPos    = new Float32Array(FLOAT_COUNT * 3);
      const floatVel    = new Float32Array(FLOAT_COUNT * 3);

      for (let i = 0; i < FLOAT_COUNT; i++) {
        let x: number, y: number, z: number, d: number;
        do {
          x = rng() * 2 - 1; y = rng() * 2 - 1; z = rng() * 2 - 1;
          d = x * x + y * y + z * z;
        } while (d > 1 || d < 0.001);
        const r = 3.0 + rng() * 0.7;
        const sc = r / Math.sqrt(d);
        floatPos[i * 3]     = x * sc;
        floatPos[i * 3 + 1] = y * sc;
        floatPos[i * 3 + 2] = z * sc;
        const spd = 0.002 + rng() * 0.003;
        floatVel[i * 3]     = (rng() - 0.5) * spd;
        floatVel[i * 3 + 1] = (rng() - 0.5) * spd;
        floatVel[i * 3 + 2] = (rng() - 0.5) * spd;
      }

      const floatGeo = new THREE.BufferGeometry();
      floatGeo.setAttribute("position", new THREE.BufferAttribute(floatPos.slice(), 3));
      const floatMat = new THREE.PointsMaterial({
        size: 0.035, color: 0xe0d8ff,
        transparent: true, opacity: 0.65, sizeAttenuation: true,
      });
      const floatPoints = new THREE.Points(floatGeo, floatMat);
      floatPoints.frustumCulled = false;

      const group = new THREE.Group();
      group.add(nodePoints, lines, floatPoints);
      scene.add(group);

      // ── Animation state ────────────────────────────────────────────────
      const audioData    = new Uint8Array(32);
      let   audioScale   = 1;

      // Smooth intensity: 1.0 idle → 1.8 active
      let currentIntensity = 1.0;

      // Heartbeat micro-event state
      let   heartbeatStrength = 0;   // positive = outward push, negative = inward pull
      let   heartbeatPhase    = 0;   // 0=idle, 1=compress, 2=release, 3=decay

      // Edge flash micro-event state
      let   flashEdge     = -1;      // which segment index is flashing
      let   flashProgress = 0;       // 0→1→0

      // Schedule next heartbeat (inward cluster pull + release)
      const scheduleHeartbeat = () => {
        const delay = 6000 + Math.random() * 10000;
        const t = setTimeout(() => {
          if (cancelled) return;
          heartbeatPhase    = 1;
          heartbeatStrength = 0;
          scheduleHeartbeat(); // recurse
        }, delay);
        timeouts.push(t);
      };

      // Schedule next edge flash
      const scheduleFlash = () => {
        const delay = 2000 + Math.random() * 4000;
        const t = setTimeout(() => {
          if (cancelled) return;
          flashEdge     = Math.floor(Math.random() * MAX_SEGS);
          flashProgress = 0;
          scheduleFlash();
        }, delay);
        timeouts.push(t);
      };

      scheduleHeartbeat();
      scheduleFlash();

      // ── Animation loop ─────────────────────────────────────────────────
      const clock = new THREE.Clock();
      let   lastT = 0;

      const animate = () => {
        if (cancelled) return;
        frameRef.current = requestAnimationFrame(animate);

        const t  = clock.getElapsedTime();
        const dt = Math.min(t - lastT, 0.05); // cap delta for tab-backgrounding
        lastT = t;

        const TAU = Math.PI * 2;

        // ── Intensity target ──────────────────────────────────────────
        const st = statusRef.current;
        const isActive = st === "speaking" || st === "recording" || st === "thinking" || st === "transcribing";
        const targetIntensity = isActive ? 1.7 : 1.0;
        currentIntensity += (targetIntensity - currentIntensity) * 0.04;

        // ── Audio scale ───────────────────────────────────────────────
        const liveAnalyser = analyserRef.current;
        if (liveAnalyser && st === "speaking") {
          liveAnalyser.getByteFrequencyData(audioData);
          const raw = audioData.reduce((a, b) => a + b, 0) / audioData.length / 255;
          audioScale += ((1 + raw * 0.35) - audioScale) * 0.18;
        } else {
          audioScale += (1 - audioScale) * 0.06;
        }

        // ── Layered motion — never sync ───────────────────────────────
        // Breathing (3.8 s) — expands / contracts sphere surface
        const breathAmp    = 0.04 * currentIntensity;
        const breathRadius = BASE_RADIUS * (1 + Math.sin(t * TAU / 3.8) * breathAmp);

        // Overall sway (5.2 s) + slow continuous spin
        group.rotation.y += 0.0018 * currentIntensity;
        group.rotation.x  = Math.sin(t * TAU / 5.2) * 0.18 * currentIntensity;
        group.rotation.z  = Math.sin(t * TAU / 7.9) * 0.05;

        // Position drift via Perlin noise (7.1 s effective period)
        const driftSpeed = 0.05 + currentIntensity * 0.025;
        group.position.x  = noisePos(t * driftSpeed,       0.0) * 0.35;
        group.position.y  = noisePos(0.0, t * driftSpeed + 99)  * 0.35;

        // Global scale = audio + subtle sway (5.2 s)
        const swayScale = 1 + Math.sin(t * TAU / 5.2 + 1.5) * 0.015;
        group.scale.setScalar(audioScale * swayScale);

        // ── Heartbeat micro-event ──────────────────────────────────────
        // Phase 1: compress (300 ms inward), 2: release (400 ms outward), 3: decay
        const HB_SPEEDS = [0, 1 / 0.3, 1 / 0.4, 1 / 0.6]; // phase duration in seconds
        if (heartbeatPhase === 1) {
          heartbeatStrength -= dt * HB_SPEEDS[1] * 0.5;
          if (heartbeatStrength <= -0.5) { heartbeatPhase = 2; }
        } else if (heartbeatPhase === 2) {
          heartbeatStrength += dt * HB_SPEEDS[2] * 0.8;
          if (heartbeatStrength >= 0.35) { heartbeatPhase = 3; }
        } else if (heartbeatPhase === 3) {
          heartbeatStrength *= 0.92;
          if (Math.abs(heartbeatStrength) < 0.005) { heartbeatPhase = 0; heartbeatStrength = 0; }
        }

        // ── Update node positions ──────────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const nodePosAttr  = nodeGeo.attributes.position as any;
        const pos          = nodePosAttr.array as Float32Array;
        const nodeSpeedMul = 1 + (currentIntensity - 1) * 1.2; // faster when active

        for (let i = 0; i < NODE_COUNT; i++) {
          const ix = i * 3, iy = ix + 1, iz = ix + 2;

          // Per-node Perlin offset (surface feels organic, not rigid)
          const nx = noiseNode(nodeNoiseOff[i * 2]     + t * 0.38, 0) * 0.09 * currentIntensity;
          const ny = noiseNode(0, nodeNoiseOff[i * 2 + 1] + t * 0.38) * 0.09 * currentIntensity;
          // Perlin noise in z via offset trick
          const nz = noiseNode(nodeNoiseOff[i * 2] * 0.5 + t * 0.3, nodeNoiseOff[i * 2 + 1] * 0.5) * 0.06 * currentIntensity;

          pos[ix] += nodeVel[ix] * nodeSpeedMul;
          pos[iy] += nodeVel[iy] * nodeSpeedMul;
          pos[iz] += nodeVel[iz] * nodeSpeedMul;

          // Sphere surface constraint with breathing radius
          const dist = Math.sqrt(pos[ix] ** 2 + pos[iy] ** 2 + pos[iz] ** 2);
          // Target = breathing sphere + per-node noise surface offset
          const noiseR   = breathRadius * (1 + (nx + ny + nz) / (BASE_RADIUS * 3));
          const deviation = dist - noiseR;
          if (Math.abs(deviation) > 0.15) {
            const pull = 0.0018 * deviation / dist;
            nodeVel[ix] -= pos[ix] * pull;
            nodeVel[iy] -= pos[iy] * pull;
            nodeVel[iz] -= pos[iz] * pull;
          }

          // Heartbeat radial force
          if (heartbeatStrength !== 0 && dist > 0.01) {
            const hbForce = heartbeatStrength * 0.0025;
            nodeVel[ix] += (pos[ix] / dist) * hbForce;
            nodeVel[iy] += (pos[iy] / dist) * hbForce;
            nodeVel[iz] += (pos[iz] / dist) * hbForce;
          }

          // Velocity damping
          nodeVel[ix] *= 0.985;
          nodeVel[iy] *= 0.985;
          nodeVel[iz] *= 0.985;
        }
        nodePosAttr.needsUpdate = true;

        // ── Edge secondary motion (display positions lag behind actual) ──
        // Spring constant: loose enough to create visible delay/stretch.
        // More lag when intensity is low (idle = heavy/slow), less when active.
        const spring  = 0.12 + currentIntensity * 0.04;
        const damping = 0.78;
        for (let i = 0; i < NODE_COUNT; i++) {
          const ix = i * 3, iy = ix + 1, iz = ix + 2;
          const fx = (pos[ix] - nodeDisplay[ix]) * spring;
          const fy = (pos[iy] - nodeDisplay[iy]) * spring;
          const fz = (pos[iz] - nodeDisplay[iz]) * spring;
          nodeDisplayVel[ix] = nodeDisplayVel[ix] * damping + fx;
          nodeDisplayVel[iy] = nodeDisplayVel[iy] * damping + fy;
          nodeDisplayVel[iz] = nodeDisplayVel[iz] * damping + fz;
          nodeDisplay[ix] += nodeDisplayVel[ix];
          nodeDisplay[iy] += nodeDisplayVel[iy];
          nodeDisplay[iz] += nodeDisplayVel[iz];
        }

        // ── Rebuild edges using DISPLAY positions (so lines lag) ─────────
        // Edge flash progress (0→1 bright, 1→0 fade)
        if (flashEdge >= 0) {
          flashProgress += dt * 3.5; // full cycle ≈ 0.57 s
          if (flashProgress > 2) { flashEdge = -1; flashProgress = 0; }
        }
        const flashBrightness = flashEdge >= 0
          ? Math.sin(flashProgress * Math.PI * 0.5) * 0.9
          : 0;

        // Default line colour = #8b6fe8 normalised to RGB 0-1
        const DR = 0.545, DG = 0.435, DB = 0.910;
        // Bright flash colour = near white-purple
        const FR = 0.92,  FG = 0.82,  FB = 1.0;

        let segCount = 0;
        for (let a = 0; a < NODE_COUNT && segCount < MAX_SEGS - 1; a++) {
          const ax = nodeDisplay[a * 3], ay = nodeDisplay[a * 3 + 1], az = nodeDisplay[a * 3 + 2];
          for (let b = a + 1; b < NODE_COUNT && segCount < MAX_SEGS - 1; b++) {
            const dx = ax - nodeDisplay[b * 3];
            const dy = ay - nodeDisplay[b * 3 + 1];
            const dz = az - nodeDisplay[b * 3 + 2];
            if (dx * dx + dy * dy + dz * dz < CONNECTION_DIST * CONNECTION_DIST) {
              const s = segCount * 6;
              linePos[s]     = ax;            linePos[s + 1] = ay;            linePos[s + 2] = az;
              linePos[s + 3] = nodeDisplay[b * 3]; linePos[s + 4] = nodeDisplay[b * 3 + 1]; linePos[s + 5] = nodeDisplay[b * 3 + 2];

              // Vertex colours
              const isFlash = segCount === flashEdge;
              const r = isFlash ? FR : DR;
              const g = isFlash ? FG : DG;
              const bv = isFlash ? FB : DB;
              const brightness = isFlash ? (1 + flashBrightness) : 1;
              lineCol[s]     = r * brightness; lineCol[s + 1] = g * brightness; lineCol[s + 2] = bv * brightness;
              lineCol[s + 3] = r * brightness; lineCol[s + 4] = g * brightness; lineCol[s + 5] = bv * brightness;

              segCount++;
            }
          }
        }
        linePosAttr.needsUpdate = true;
        lineColAttr.needsUpdate = true;
        lineGeo.setDrawRange(0, segCount * 2);

        // Line opacity: slightly elevated when active
        linesMat.opacity = 0.38 + currentIntensity * 0.09;

        // ── Float particles ────────────────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const floatPosAttr = floatGeo.attributes.position as any;
        const fp = floatPosAttr.array as Float32Array;
        const floatSpeedMul = 0.9 + currentIntensity * 0.4;
        for (let i = 0; i < FLOAT_COUNT; i++) {
          const ix = i * 3, iy = ix + 1, iz = ix + 2;
          fp[ix] += floatVel[ix] * floatSpeedMul;
          fp[iy] += floatVel[iy] * floatSpeedMul;
          fp[iz] += floatVel[iz] * floatSpeedMul;
          const d = Math.sqrt(fp[ix] ** 2 + fp[iy] ** 2 + fp[iz] ** 2);
          if (d > 3.9 || d < 2.8) {
            floatVel[ix] *= -1; floatVel[iy] *= -1; floatVel[iz] *= -1;
          }
        }
        floatPosAttr.needsUpdate = true;

        // Node point opacity — pulsates with breathing + status
        nodeMat.opacity = 0.80 + Math.sin(t * TAU / 3.8) * 0.12 * currentIntensity;

        renderer.render(scene, camera);
      };

      animate();

      // ── Cleanup ────────────────────────────────────────────────────────
      const dispose = () => {
        cancelAnimationFrame(frameRef.current);
        timeouts.forEach(clearTimeout);
        renderer.dispose();
        nodeGeo.dispose(); nodeMat.dispose();
        lineGeo.dispose(); linesMat.dispose();
        floatGeo.dispose(); floatMat.dispose();
      };

      // Store so the outer return can call it if the async resolved after unmount
      (canvas as unknown as { __velcroDispose?: () => void }).__velcroDispose = dispose;

    })().catch(console.error);

    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
      cancelAnimationFrame(frameRef.current);
      const dispose = (canvas as unknown as { __velcroDispose?: () => void }).__velcroDispose;
      dispose?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {/* Ambient glow — transitions with status */}
      <div
        className="pointer-events-none absolute rounded-full transition-all duration-700"
        style={{
          width: "340px", height: "340px",
          background:
            isRecording
              ? "radial-gradient(circle, rgba(139,92,246,0.55) 0%, transparent 65%)"
              : status === "speaking"
              ? "radial-gradient(circle, rgba(99,102,241,0.65) 0%, transparent 65%)"
              : status === "thinking" || status === "transcribing"
              ? "radial-gradient(circle, rgba(129,140,248,0.35) 0%, transparent 65%)"
              : "radial-gradient(circle, rgba(99,102,241,0.22) 0%, transparent 65%)",
          filter: "blur(26px)",
        }}
      />

      {/* Three.js canvas */}
      <canvas
        ref={canvasRef}
        style={{ width: "500px", height: "500px", display: "block" }}
      />

      {/* VELCRO wordmark */}
      <span
        className="pointer-events-none absolute text-[13px] font-light text-white/70 transition-opacity duration-500"
        style={{
          letterSpacing: "0.55em",
          opacity: status === "thinking" || status === "transcribing" ? 0.3 : 0.65,
        }}
      >
        VELCRO
      </span>

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
