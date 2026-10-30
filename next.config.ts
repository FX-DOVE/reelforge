import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["playwright-core", "msedge-tts"],
  async redirects() { return [{ source: "/research/:path*", destination: "/studio", permanent: false }, { source: "/research", destination: "/studio", permanent: false }]; },
  // the desktop stream WebSocket (Next proxies the upgrade; on the VPS Caddy routes /desk/ws straight to the desk)
  async rewrites() { return [{ source: "/desk/ws", destination: (process.env.DESK_URL || "http://127.0.0.1:7900") + "/ws" }]; },
  async headers() { return [{ source: "/brand/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }]; },
  // /s/<key>/ and /p/<user>/<slug>/ serve static sites whose relative asset URLs need the trailing slash
  skipTrailingSlashRedirect: true,
  images: { unoptimized: true },
  experimental: { serverActions: { bodySizeLimit: "16mb" } },
};
export default nextConfig;
