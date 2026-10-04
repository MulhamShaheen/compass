import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Playwright suites run their own dev server next to yours; Next 16 allows one per build folder.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async headers() {
    // The service worker must always be re-checked so updates reach installed apps.
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
};

export default nextConfig;
