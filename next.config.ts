import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // foto delle piante fino a 5 MB (il browser le rimpicciolisce comunque prima dell'invio)
  experimental: {
    serverActions: { bodySizeLimit: "5mb" },
  },
  // il "db" dei campi letto a runtime dalla pipeline di analisi (lib/kasungu/db.ts)
  outputFileTracingIncludes: {
    "/*": ["./data/kasungu/*.csv"],
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
