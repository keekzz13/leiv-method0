import type { NextConfig } from "next";

/**
 * Cross-origin isolation is required for SharedArrayBuffer,
 * which @ffmpeg/core-mt needs for multi-threaded WASM.
 *
 * COEP "credentialless" is preferred over "require-corp" so
 * CDN-loaded cores (jsDelivr/unpkg) still work with blob URLs.
 */
const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
          // Helpful for own static assets under isolation
          {
            key: "Cross-Origin-Resource-Policy",
            value: "cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
