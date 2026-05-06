"use client";

import { motion } from "framer-motion";
import { MapPin, Calendar } from "lucide-react";

export interface SMLoc {
  name:  string;
  date:  string;
  event: string;
  type?: "work" | "personal" | "travel";
}
export interface SMData {
  range:     string;
  locations: SMLoc[];
}

const TYPE_COLOR: Record<string, string> = {
  work:     "#818cf8",
  personal: "#34d399",
  travel:   "#fbbf24",
};
const DEFAULT_LOC_COLOR = "#a78bfa";

function locColor(loc: SMLoc) {
  return loc.type ? (TYPE_COLOR[loc.type] ?? DEFAULT_LOC_COLOR) : DEFAULT_LOC_COLOR;
}

export default function SpatialMap({ data }: { data: SMData }) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#6b6b8a" }}>Orte</div>
        <div className="mt-1 text-base font-medium" style={{ color: "#e8e8f0" }}>{data.range}</div>
      </motion.div>

      {/* Legend */}
      {data.locations.some((l) => l.type) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="flex gap-3"
        >
          {Object.entries(TYPE_COLOR).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
              <span className="text-[10px] capitalize" style={{ color: "#7878a0" }}>{type}</span>
            </div>
          ))}
        </motion.div>
      )}

      {/* Location cards */}
      <motion.div
        className="space-y-2"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      >
        {data.locations.map((loc, i) => {
          const color = locColor(loc);
          return (
            <motion.div
              key={i}
              variants={{
                hidden: { opacity: 0, x: -14 },
                show:   { opacity: 1, x: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
              }}
              className="flex items-start gap-3 rounded-xl p-3"
              style={{
                background: `${color}0a`,
                border: `1px solid ${color}25`,
              }}
            >
              {/* Pin icon */}
              <div
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${color}18`, border: `1px solid ${color}35` }}
              >
                <MapPin size={13} style={{ color }} />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium truncate" style={{ color: "#e8e8f0" }}>
                    {loc.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Calendar size={9} style={{ color: "#6b6b8a" }} />
                    <span className="text-[10px]" style={{ color: "#6b6b8a" }}>{loc.date}</span>
                  </div>
                </div>
                <div className="mt-0.5 text-xs truncate" style={{ color: "#7878a0" }}>
                  {loc.event}
                </div>
              </div>

              {/* Accent line */}
              <div
                className="absolute left-0 top-1/4 h-1/2 w-0.5 rounded-r"
                style={{ background: color }}
              />
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
