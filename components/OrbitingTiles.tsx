"use client";

import { motion } from "framer-motion";

export interface TileEntity {
  emoji:      string;
  name:       string;
  descriptor: string;
}
export interface TilesData {
  entities: TileEntity[];
}

/**
 * Computes the orbit position for each tile around the orb.
 *
 * Layout rules (from spec):
 *  • 1 entity   → centered above the orb
 *  • 2 entities → left and right
 *  • 3+         → circular orbit around the orb
 *
 * Returns CSS pixel offsets relative to the orb center (positive y = below).
 */
function tilePosition(
  index:  number,
  total:  number,
  orbitR: number,
): { x: number; y: number } {
  if (total === 1) {
    return { x: 0, y: -orbitR };
  }
  if (total === 2) {
    return { x: index === 0 ? -orbitR : orbitR, y: 0 };
  }
  // 3+: distribute evenly on a circle, starting at top
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(angle) * orbitR, y: Math.sin(angle) * orbitR };
}

export default function OrbitingTiles({ data }: { data: TilesData }) {
  const entities = data.entities.slice(0, 6);
  const total    = entities.length;
  if (total === 0) return null;

  // Orbit radius: enough to clear the orb (canvas ~500px → ~250px half) plus tile width.
  // We use 300px so tiles sit just outside the orb's outer particle cloud.
  const orbitR = 300;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
    >
      {/* Tiles container — center is the orb's nominal position */}
      <div className="relative" style={{ width: 0, height: 0 }}>
        {entities.map((e, i) => {
          const pos = tilePosition(i, total, orbitR);
          return (
            <motion.div
              key={`${e.name}-${i}`}
              className="absolute"
              style={{
                left:      pos.x,
                top:       pos.y,
                transform: "translate(-50%, -50%)",
              }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{
                opacity: 1,
                scale:   1,
                // Subtle floating motion — each tile breathes on its own phase
                y: [0, -4, 0, 4, 0],
              }}
              exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.3 } }}
              transition={{
                opacity: { duration: 0.5, delay: 0.4 + i * 0.15, ease: [0.22, 1, 0.36, 1] },
                scale:   { duration: 0.5, delay: 0.4 + i * 0.15, ease: [0.22, 1, 0.36, 1] },
                y:       { duration: 6 + i * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 },
              }}
            >
              <div
                className="flex flex-col items-center gap-1.5 rounded-2xl px-4 py-3 backdrop-blur-md"
                style={{
                  background: "rgba(20,20,32,0.92)",
                  border:     "1px solid rgba(167,139,250,0.30)",
                  boxShadow:  "0 0 32px rgba(129,140,248,0.18), 0 8px 24px rgba(0,0,0,0.45)",
                  minWidth:   140,
                  maxWidth:   180,
                }}
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(129,140,248,0.20), rgba(167,139,250,0.10))",
                    border:     "1px solid rgba(167,139,250,0.25)",
                  }}
                >
                  {e.emoji}
                </div>
                <div className="text-center">
                  <div className="text-xs font-semibold leading-tight" style={{ color: "#e8e8f0" }}>
                    {e.name}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-snug" style={{ color: "#9494b0" }}>
                    {e.descriptor}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
