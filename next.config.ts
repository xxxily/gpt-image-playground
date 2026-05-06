import type { NextConfig } from "next";

const isDesktop = !!process.env.DESKTOP_BUILD;

const nextConfig: NextConfig = {
  output: isDesktop ? 'export' : undefined,
  images: {
    unoptimized: isDesktop,
  },
};

export default nextConfig;
