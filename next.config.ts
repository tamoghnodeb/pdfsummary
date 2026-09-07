import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence Turbopack warning (Next.js 16 uses Turbopack by default)
  turbopack: {},

  // Allow large PDF processing in API routes
  experimental: {
    serverActions: {
      bodySizeLimit: "52mb",
    },
  },
};

export default nextConfig;
