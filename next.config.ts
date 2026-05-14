import type { NextConfig } from "next";

const isDesktop = !!process.env.DESKTOP_BUILD;
const isStandaloneServerBuild = process.env.NEXT_STANDALONE_BUILD === '1';

const nextConfig: NextConfig = {
  output: isDesktop ? 'export' : isStandaloneServerBuild ? 'standalone' : undefined,
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: isDesktop,
  },
};

export default nextConfig;
