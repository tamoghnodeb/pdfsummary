import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence Turbopack root warning (Next.js 16 uses Turbopack by default)
  turbopack: {},

  // Mark pdf-parse as server external so its bundled pdfjs-dist
  // loads directly from node_modules on both Turbopack and Vercel
  serverExternalPackages: ["pdf-parse"],

  // Allow large PDF processing in API routes (up to 50 MB)
  experimental: {
    serverActions: {
      bodySizeLimit: "52mb",
    },
  },
};

export default nextConfig;
