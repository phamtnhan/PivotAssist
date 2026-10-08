/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  // Prisma's native query engine must resolve from the server runtime rather
  // than being inlined into the Next.js route bundle.
  serverExternalPackages: ["@pivotassist/db", "@prisma/client", "pdfjs-dist", "jszip", "ioredis"],
  // Keep compiled routes in memory so navigating back does not recompile (webpack fallback).
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 24,
  },
  // webpackMemoryOptimizations: giảm old-space khi compile nhiều route (V8 Mark-Compact OOM).
  experimental: {
    webpackMemoryOptimizations: true,
  },
  // REQ-0034 — hiring pages encode untrusted/LLM text in React; CSP documents the policy (CANDIDATE-SEC-0020)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              process.env.NODE_ENV === "production"
                ? "script-src 'self' 'unsafe-inline'"
                : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              process.env.NODE_ENV === "production"
                ? "connect-src 'self' wss: https:"
                : "connect-src 'self' ws: wss: http://localhost:3000 http://127.0.0.1:3000 https:",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
