import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const ENGINE = process.env.QAFUSIONX_ENGINE_ORIGIN ?? "http://127.0.0.1:43180";
const consoleRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: consoleRoot,
  },
  async rewrites() {
    return [
      {
        source: "/qfx/:path*",
        destination: `${ENGINE}/:path*`,
      },
    ];
  },
};

export default nextConfig;
