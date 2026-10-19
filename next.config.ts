import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// مساحة الملفات على R2: الرابط العام للعرض (صريح من MEDIA_BASE_URL وإلا media.<النطاق الرئيسي>). الرفع يمر بالخادم
// (app/api/upload) فلا يتصل المتصفح بـ R2 مباشرة ولا يحتاج هنا إلا لعرض الصور.
const mediaOrigin = (() => {
  const explicit = (process.env.MEDIA_BASE_URL || process.env.NEXT_PUBLIC_MEDIA_BASE_URL || "").trim();
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || process.env.ROOT_DOMAIN || "").trim().toLowerCase();
  try {
    if (explicit) return new URL(explicit).origin;
    return root && !root.startsWith("localhost") ? `https://media.${root}` : "";
  } catch {
    return "";
  }
})();
const mediaHost = mediaOrigin ? new URL(mediaOrigin).hostname : "";
// احتياط ثابت لمساحة ملفات الإنتاج: إن غابت متغيرات النطاق وقت البناء (بناء Cloudflare مثلاً) كان media-src لا يضم
// media.colapia.com، فيرفض المتصفح تشغيل فيديو الواجهة الذي يرفعه التاجر على نطاق متجره.
const PROD_MEDIA = "https://media.colapia.com";
// إزالة الخلفية في المتصفح (اختيارية، components/onboarding/bg-removal.ts): المكتبة وملفات wasm من jsDelivr بإصدار مثبّت،
// وملفات النموذج من Hugging Face (تحويلات إلى نطاقات hf.co الفرعية).
const BG_TOOL_SCRIPT = "https://cdn.jsdelivr.net";
const BG_TOOL_CONNECT = ["https://cdn.jsdelivr.net", "https://huggingface.co", "https://*.huggingface.co", "https://*.hf.co"];

// ═══════════════════════════════════════════════════════════════════════════
// Content Security Policy — يشمل:
//  - Pusher WebSocket + SockJS fallback + stats
//  - Google Fonts (stylesheet + font files)
//  - Vercel Analytics + Speed Insights
//  - Sentry (اختياري — للتتبع)
// ═══════════════════════════════════════════════════════════════════════════
const cspHeader = [
  "default-src 'self'",

  `img-src 'self' data: blob: ${mediaOrigin} ${PROD_MEDIA} https://utfs.io https://*.ufs.sh https://*.fbcdn.net https://*.cdninstagram.com https://picsum.photos https://api.dicebear.com https://*.googleusercontent.com https://lh3.googleusercontent.com https://www.facebook.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://analytics.tiktok.com`,

  `media-src 'self' data: blob: ${mediaOrigin} ${PROD_MEDIA} https://utfs.io https://*.ufs.sh`,

  [
    "script-src 'self' 'unsafe-inline'",
    isDev ? "'unsafe-eval'" : "",
    // تشغيل WebAssembly لأداة إزالة الخلفية (لا يسمح بـ eval للنصوص).
    "'wasm-unsafe-eval'",
    BG_TOOL_SCRIPT,
    "https://connect.facebook.net",
    "https://www.googletagmanager.com",
    "https://analytics.tiktok.com",
    "https://va.vercel-scripts.com",
    // قياس الزيارات من Cloudflare (Web Analytics) يحقن هذا السكربت تلقائياً متى فُعّل على الموقع.
    "https://static.cloudflareinsights.com",
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
    mediaOrigin,
    PROD_MEDIA,
    ...BG_TOOL_CONNECT,
    // ملفات UploadThing القديمة (عرضها وقراءتها فقط؛ الرفع كله يمر بالخادم).
    "https://utfs.io",
    "https://*.ufs.sh",
    // قياس Cloudflare Web Analytics
    "https://cloudflareinsights.com",
    // Social
    "https://connect.facebook.net",
    "https://www.facebook.com",
    // بكسلات التاجر: GA4 وتيك توك
    "https://www.google-analytics.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://www.googletagmanager.com",
    "https://analytics.tiktok.com",
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
  "object-src 'none'",
  isDev ? "" : "upgrade-insecure-requests",
].filter(Boolean).join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspHeader },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // رأس قديم قد يفتح ثغرات في متصفحات قديمة؛ القيمة 0 هي التوصية الحالية (الحماية الحقيقية من CSP).
  { key: "X-XSS-Protection", value: "0" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // خادم Node مستقل (Dockerfile): يحمل ما تحتاجه الصفحات فقط، فتصغر الصورة وذاكرة التشغيل على Railway أو أي مضيف.
  // Vercel يتجاهله ويبني بطريقته.
  output: "standalone",
  // الـ commit المنشور (Cloudflare Workers Builds أو Vercel أو Railway): رقم الإصدار في /api/health.
  env: {
    BUILD_COMMIT_SHA: process.env.WORKERS_CI_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? "",
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      ...(mediaHost ? [{ protocol: "https" as const, hostname: mediaHost }] : []),
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