import type { NextConfig } from "next";

import { cspHeader } from "./lib/security-headers";

// 全ルート共通のセキュリティヘッダー。
const securityHeaders = [
  cspHeader(),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs", "yauzl", "saxes", "jszip"],
  experimental: {
    // バレル import のツリーシェイクを強化し、初期 JS を削減する。
    optimizePackageImports: ["recharts", "lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
