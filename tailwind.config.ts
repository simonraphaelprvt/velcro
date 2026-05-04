import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        velcro: {
          bg: "#07070d",
          surface: "#0f0f1a",
          border: "#1c1c2e",
          muted: "#252538",
          text: "#e8e8f0",
          dim: "#5a5a78",
          accent: "#a78bfa",
          "accent-bright": "#c4b5fd",
          "accent-deep": "#7c3aed",
          "accent-2": "#34d399",
          danger: "#f87171",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["monospace"],
      },
      keyframes: {
        // Gentle idle breathing
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.85" },
          "50%": { transform: "scale(1.04)", opacity: "1" },
        },
        // Recording: sharp, fast pulse
        "pulse-record": {
          "0%, 100%": { transform: "scale(1.06)", opacity: "1" },
          "50%": { transform: "scale(1.12)", opacity: "0.9" },
        },
        // Thinking: slow shimmer via hue-rotate
        shimmer: {
          "0%": { filter: "hue-rotate(0deg) brightness(1)" },
          "33%": { filter: "hue-rotate(20deg) brightness(1.15)" },
          "66%": { filter: "hue-rotate(-15deg) brightness(0.95)" },
          "100%": { filter: "hue-rotate(0deg) brightness(1)" },
        },
        // Speaking: energetic multi-beat pulse
        speak: {
          "0%": { transform: "scale(1)" },
          "15%": { transform: "scale(1.08)" },
          "30%": { transform: "scale(1.02)" },
          "45%": { transform: "scale(1.11)" },
          "60%": { transform: "scale(1.04)" },
          "75%": { transform: "scale(1.07)" },
          "100%": { transform: "scale(1)" },
        },
        // Outer ring expansion
        "ring-expand": {
          "0%": { transform: "scale(1)", opacity: "0.5" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        // Content window slide up
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        breathe: "breathe 3.5s ease-in-out infinite",
        "pulse-record": "pulse-record 0.7s ease-in-out infinite",
        shimmer: "shimmer 2.5s ease-in-out infinite",
        speak: "speak 1.2s ease-in-out infinite",
        "ring-expand": "ring-expand 1.4s ease-out infinite",
        "ring-expand-delay": "ring-expand 1.4s ease-out 0.5s infinite",
        "slide-up": "slide-up 0.25s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        // Orb living animations
        "orb-float": "velcro-float 8s ease-in-out infinite",
        "orb-drift": "velcro-drift 13s ease-in-out infinite",
        "orb-ring-idle": "velcro-ring-idle 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
