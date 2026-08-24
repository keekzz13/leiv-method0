import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    };
    // ffmpeg.wasm worker support
    config.resolutions = config.resolutions;
    return config;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Helps FFmpeg.wasm (SharedArrayBuffer) on some browsers.
  // credentialless is safer than require-corp for external CDNs.
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
        ],
      },
    ];
  },
};

export default nextConfig;
