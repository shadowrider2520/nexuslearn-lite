import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // pdf-parse optionally requires canvas (for rendering). We don't need it —
    // alias it to false so webpack doesn't warn about a missing native module.
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
