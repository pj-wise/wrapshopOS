import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // Demo mode (src/server/demo/db.ts): PGlite loads its WASM + extension
  // bundles from its own package dir at runtime, and the demo DB replays the
  // migration SQL from disk — neither is visible to the bundler/tracer.
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-socket"],
  outputFileTracingIncludes: {
    "/**": ["./prisma/migrations/**/*.sql"],
  },
};

export default nextConfig;
