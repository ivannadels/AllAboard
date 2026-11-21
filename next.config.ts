import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is off on purpose: every screen reads live SQLite data and the
  // simulated clock, so pages are rendered per request (see `dynamic = "force-dynamic"`).
  cacheComponents: false,
  // better-sqlite3 is a native module; keep it out of the server bundle.
  serverExternalPackages: ["better-sqlite3"],
  // Search moved to `/` with the pin-board redesign; the query string carries over.
  async redirects() {
    return [{ source: "/search", destination: "/", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
