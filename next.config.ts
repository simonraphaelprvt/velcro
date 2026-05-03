import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow large audio responses from ElevenLabs
  api: {
    responseLimit: "10mb",
  },
};

export default nextConfig;
