import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @libsql/client uses native Node features; listed explicitly (Next also
  // auto-externalizes it) so it's required at runtime, not bundled.
  serverExternalPackages: ["@libsql/client"],

  // Baseline security headers applied to every response.
  async headers() {
    const dev = process.env.NODE_ENV !== "production";
    // Pragmatic CSP. Two constraints shape it:
    //  1. Next's inline bootstrap needs 'unsafe-inline'; 'unsafe-eval' is dev-only (HMR).
    //  2. The build_app preview is a sandboxed srcdoc iframe, and srcdoc INHERITS
    //     this policy — so the CDNs the coding agent uses (unpkg/jsdelivr/cdnjs)
    //     must be allowed or every React preview breaks. The iframe sandbox is
    //     the actual isolation boundary for that untrusted code.
    const appCdns = "https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' ${appCdns}${dev ? " 'unsafe-eval'" : " 'wasm-unsafe-eval'"}`,
      `style-src 'self' 'unsafe-inline' ${appCdns} https://fonts.googleapis.com`,
      "img-src 'self' data: blob: https:",
      `font-src 'self' data: ${appCdns} https://fonts.gstatic.com`,
      // 'self' + dictionary for the app itself; https: so preview apps can call
      // public APIs (image beacons already make https: exfil possible anyway).
      `connect-src 'self' https:${dev ? " ws:" : ""}`,
      "media-src 'self' blob: data:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          // Only meaningful over HTTPS (Render terminates TLS); ignored on http://localhost.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
