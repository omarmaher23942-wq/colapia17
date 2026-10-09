import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// ═══════════════════════════════════════════════════════════════════════════
// Content Security Policy — يشمل:
//  - Pusher WebSocket + SockJS fallback + stats
//  - Google Fonts (stylesheet + font files)
//  - Vercel Analytics + Speed Insights
//  - Sentry (اختياري — للتتبع)
// ═══════════════════════════════════════════════════════════════════════════
const cspHeader = [
  "default-src 'self'",

  "img-src 'self' data: blob: https://utfs.io https://*.ufs.sh https://*.fbcdn.net https://*.cdninstagram.com https://picsum.photos https://api.dicebear.com https://*.googleusercontent.com https://lh3.googleusercontent.com",

  "media-src 'self' data: blob: https://utfs.io https://*.ufs.sh",

  [
    "script-src 'self' 'unsafe-inline'",
    isDev ? "'unsafe-eval'" : "",
    "https://connect.facebook.net",
    "https://www.googletagmanager.com",
    "https://va.vercel-scripts.com",
  ]
    .filter(Boolean)
    .join(" "),

  "worker-src 'self' blob:",

  [
    "style-src 'self' 'unsafe-inline'",
    "https://fonts.googleapis.com",
  ].join(" "),

  "font-src 'self' data: https://fonts.gstatic.com",

  [
    "connect-src 'self'",
    // UploadThing
    "https://*.uploadthing.com",
    "https://*.ingest.uploadthing.com",
    "https://utfs.io",
    "https://*.ufs.sh",
    // Social
    "https://connect.facebook.net",
    "https://www.facebook.com",
    // Email
    "https://api.resend.com",
    // AI
    "https://generativelanguage.googleapis.com",
    // Pusher (WebSocket + SockJS + stats)
    "wss://*.pusher.com",
    "https://*.pusher.com",
    "https://sockjs-eu.pusher.com",
    "https://sockjs.pusher.com",
    // Vercel Analytics
    "https://va.vercel-scripts.com",
    "https://vitals.vercel-insights.com",
    // أداة المعاينة المحلية فقط (محاكي الرفع *.ut-ingest.local في scripts/dev/local.env)؛ لا أثر له في الإنتاج.
    process.env.NODE_ENV !== "production" ? (process.env.DEV_CONNECT_SRC ?? "").split(",").join(" ") : "",
  ]
    .filter(Boolean)
    .join(" "),

  "frame-src 'self' https://*.colapia.com https://www.google.com https://www.youtube.com https://youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",

  "frame-ancestors 'self' https://colapia.com https://*.colapia.com http://localhost:3000 http://*.localhost:3000",

  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspHeader },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // "امتلك متجرك" يولّد مشروع التاجر من ملفات المشروع نفسها وقت التشغيل (server/ownership/template.ts).
  outputFileTracingIncludes: {
    "/api/ownership/zip": ["./src/**/*", "./template/**/*", "./public/sounds/**/*", "./public/logo.png", "./package.json", "./package-lock.json", "./postcss.config.mjs", "./next-env.d.ts"],
    "/api/ownership/github/callback": ["./src/**/*", "./template/**/*", "./public/sounds/**/*", "./public/logo.png", "./package.json", "./package-lock.json", "./postcss.config.mjs", "./next-env.d.ts"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { protocol: "https", hostname: "utfs.io" },
      { protocol: "https", hostname: "*.ufs.sh" },
      { protocol: "https", hostname: "*.fbcdn.net" },
      { protocol: "https", hostname: "*.cdninstagram.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "*.lh3.googleusercontent.com" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
    optimizePackageImports: ["lucide-react", "motion"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;