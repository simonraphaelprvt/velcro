/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow large audio blobs from ElevenLabs
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },

  async headers() {
    // The dashboard domain that is allowed to embed VELCRO in an iframe.
    // Set VELCRO_EMBED_ORIGIN in your Vercel environment variables.
    // Example: https://your-dashboard.vercel.app  or  https://simonmoser.dev
    const embedOrigin = process.env.VELCRO_EMBED_ORIGIN ?? "*";

    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: [
          // Allow framing from the dashboard domain only
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors 'self' ${embedOrigin}`,
          },
          // Fallback for older browsers
          {
            key: "X-Frame-Options",
            // ALLOW-FROM is deprecated but harmless; CSP above is what modern browsers use
            value: "SAMEORIGIN",
          },
          // Microphone permission policy — allow in frames
          {
            key: "Permissions-Policy",
            value: "microphone=*",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
