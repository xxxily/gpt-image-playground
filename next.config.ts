import type { NextConfig } from "next";
import { readdirSync, rmSync } from "fs";
import { resolve } from "path";

const isDesktop = !!process.env.DESKTOP_BUILD;

if (isDesktop) {
  const apiDir = resolve(process.cwd(), 'src/app/api');
  try {
    const entries = readdirSync(apiDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        rmSync(resolve(apiDir, entry.name), { recursive: true, force: true });
      }
    }
  } catch { /* ignore */ }
}

const nextConfig: NextConfig = {
  output: isDesktop ? 'export' : undefined,
  images: {
    unoptimized: isDesktop,
  },
};

export default nextConfig;
