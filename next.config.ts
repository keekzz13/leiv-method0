import type { NextConfig } from "next";

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
  // No COOP / COEP headers — not needed anymore (no FFmpeg.wasm)
};

export default nextConfig;
