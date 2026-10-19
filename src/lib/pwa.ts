// pwa.ts — منطق خالص لتطبيق الويب (manifest المنصة والمتجر، وقواعد ظهور اقتراح التثبيت).
// بلا اعتماد على المتصفح أو الخادم فيُختبر مباشرة.

export const STORE_ICON_PATH = "/api/storefront/icon";
export const PLATFORM_APP_NAME = "كولابيا";
const HEX = /^#[0-9a-f]{3,8}$/i;
const hexOr = (v: unknown, fallback: string) => (typeof v === "string" && HEX.test(v) ? v : fallback);

type ManifestIcon = { src: string; sizes: string; type: string; purpose: string };

function mimeOf(url: string): string {
  const path = url.split(/[?#]/)[0]?.toLowerCase() ?? "";
  if (path.endsWith(".svg") || path === STORE_ICON_PATH) return "image/svg+xml";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

const COMMON = {
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "any",
  dir: "rtl",
  lang: "ar",
  prefer_related_applications: false,
} as const;

/** manifest المنصة: اسم كولابيا وأيقونات PNG مولّدة من الشعار (any وmaskable). */
export function platformManifest() {
  return {
    id: "/",
    name: PLATFORM_APP_NAME,
    short_name: PLATFORM_APP_NAME,
    description: "لوحة التحكم بمتجرك: الطلبات والمنتجات والعملاء في مكان واحد.",
    ...COMMON,
    background_color: "#07091a",
    theme_color: "#07091a",
    categories: ["business", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ] satisfies ManifestIcon[],
    shortcuts: [
      { name: "الطلبات", short_name: "الطلبات", url: "/dashboard/orders" },
      { name: "المنتجات", short_name: "المنتجات", url: "/dashboard/products" },
    ],
  };
}

export type StoreManifestInput = {
  name: string;
  tagline?: string | null;
  logoUrl?: string | null;
  palette?: { background?: unknown; primary?: unknown } | null;
};

/** manifest المتجر: اسمه وألوان هويته وشعاره، ولا يظهر فيه شيء من المنصة أبداً. */
export function storeManifest(input: StoreManifestInput) {
  const name = input.name.trim() || "المتجر";
  const logo = input.logoUrl && /^(https:\/\/|\/)/.test(input.logoUrl) ? input.logoUrl : null;
  const src = logo ?? STORE_ICON_PATH;
  const type = mimeOf(src);
  // الشعار الخارجي لا نعرف مقاسه فيُعلن "any"، والمتصفح يختار الأنسب.
  const icons: ManifestIcon[] = [
    { src, sizes: type === "image/svg+xml" ? "any" : "192x192 512x512", type, purpose: "any" },
  ];
  return {
    id: "/",
    name,
    short_name: Array.from(name).slice(0, 12).join(""),
    description: input.tagline?.trim() || name,
    ...COMMON,
    orientation: "portrait" as const,
    background_color: hexOr(input.palette?.background, "#ffffff"),
    theme_color: hexOr(input.palette?.primary, "#111827"),
    categories: ["shopping"],
    icons,
    shortcuts: [
      { name: "سلة التسوق", short_name: "السلة", url: "/cart" },
      { name: "طلباتي", short_name: "طلباتي", url: "/track" },
    ],
  };
}

/** الأيقونات التي يعلنها metadata المتجر: شعاره أو الحرف الأول، ولا أيقونة منصة أبداً. */
export function storeIconLinks() {
  return { icon: STORE_ICON_PATH, shortcut: STORE_ICON_PATH, apple: STORE_ICON_PATH };
}

// ───────── قواعد اقتراح التثبيت ─────────

export const INSTALL_DISMISS_DAYS = 14;
const DAY = 86_400_000;

export function isDismissed(dismissedAt: number | null | undefined, now: number): boolean {
  if (!dismissedAt || !Number.isFinite(dismissedAt)) return false;
  return now - dismissedAt < INSTALL_DISMISS_DAYS * DAY;
}

const BOT_RE = /bot|crawl|spider|slurp|lighthouse|headless|facebookexternalhit|preview|ia_archiver/i;
export const isBotAgent = (ua: string) => !ua || BOT_RE.test(ua);

export function isIosSafari(ua: string): boolean {
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua));
  if (!ios) return false;
  // متصفحات iOS الأخرى (كروم/فايرفوكس/إيدج/تطبيقات داخلية) لا تثبّت إلا من سفاري.
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line\//.test(ua);
}

/** متجر: يظهر بعد ثاني صفحة يزورها المتسوق أو بعد إضافة للسلة، وليس في الدفع. */
export function storeShouldPrompt(o: { pageViews: number; addedToCart: boolean; path: string }): boolean {
  if (/^\/(checkout|cart|order)(\/|$)/.test(o.path)) return false;
  return o.pageViews >= 2 || o.addedToCart;
}
