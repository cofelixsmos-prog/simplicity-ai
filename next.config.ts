import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @libsql/client uses native Node features; listed explicitly (Next also
  // auto-externalizes it) so it's required at runtime, not bundled.
  serverExternalPackages: ["@libsql/client"],

  // Baseline security headers applied to every response.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
