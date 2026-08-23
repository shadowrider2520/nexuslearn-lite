import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Config for standard Webpack
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
  // Config for Turbopack to prevent conflict errors/warnings
  turbopack: {
    resolveAlias: {
      canvas: "./lib/ai/empty-mock.ts",
    },
  },
};

export default nextConfig;
