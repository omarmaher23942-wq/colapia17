// next.config.ts — إعدادات مشروعك. المتجر ولوحة التحكم على النطاق نفسه، والنشر على Cloudflare Workers (OpenNext).
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const isDev = process.env.NODE_ENV === "development";
// يتيح استخدام ربط R2 (MEDIA) في التطوير المحلي عبر wrangler. لا أثر له في البناء والنشر.
if (isDev) initOpenNextCloudflareForDev();

// نقطة نهاية ImageKit المخصصة (إن لم تكن ik.imagekit.io الافتراضية) تُضاف لسياسة أمان المحتوى.
const imagekitEndpoint = (() => {
  try {
    const raw = (process.env.IMAGEKIT_URL_ENDPOINT || process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "").trim();
    return raw ? new URL(raw).origin : "";
  } catch {
    return "";
  }
})();

// أداة إزالة الخلفية في الإعداد (اختيارية): المكتبة وملفات wasm من jsDelivr بإصدار مثبّت، والنموذج من Hugging Face.
const BG_TOOL_SCRIPT = "https://cdn.jsdelivr.net";
const BG_TOOL_CONNECT = ["https://cdn.jsdelivr.net", "https://huggingface.co", "https://*.huggingface.co", "https://*.hf.co"];

const csp = [
  "default-src 'self'",
  `img-src 'self' data: blob: https://ik.imagekit.io https://*.imagekit.io ${imagekitEndpoint} https://*.googleusercontent.com https://www.facebook.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://analytics.tiktok.com`,
  "media-src 'self' data: blob:",
  [
    "script-src 'self' 'unsafe-inline'",
    isDev ? "'unsafe-eval'" : "",
    "'wasm-unsafe-eval'",
    BG_TOOL_SCRIPT,
    "https://connect.facebook.net",
    "https://www.googletagmanager.com",
    "https://analytics.tiktok.com",
    "https://static.cloudflareinsights.com",
  ]
    .filter(Boolean)
    .join(" "),
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  [
    "connect-src 'self'",
    ...BG_TOOL_CONNECT,
    "https://cloudflareinsights.com",
    "https://connect.facebook.net",
    "https://www.facebook.com",
    "https://www.google-analytics.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://www.googletagmanager.com",
    "https://analytics.tiktok.com",
  ].join(" "),
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  isDev ? "" : "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // الصور تُعرض من ImageKit بتحويلات في الرابط نفسه (الحجم والجودة والصيغة): src/lib/image-loader.ts.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
  },
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
    optimizePackageImports: ["lucide-react", "motion"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "0" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
