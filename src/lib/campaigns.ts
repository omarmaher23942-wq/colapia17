// campaigns.ts — روابط الحملات الإعلانية للمتجر: كل حملة رابط قصير /go/<slug> يفتح وجهة (الرئيسية أو منتج أو قسم)
// بمعاملات UTM وكود خصم اختياري، وتُنسب الطلبات التي تأتي منه إلى الحملة (orders.source = campaign:<slug>).
// منطق خالص مختبَر يستخدمه مسار التحويل والدفع واللوحة.
import type { z } from "zod";
import type { campaignSchema } from "@/blueprint/schema";

export type Campaign = z.infer<typeof campaignSchema>;
export const CAMPAIGN_COOKIE = "clp_cmp";
export const CAMPAIGN_DAYS = 30;

export const PLATFORM_LABEL: Record<Campaign["platform"], string> = {
  facebook: "فيسبوك",
  instagram: "إنستجرام",
  tiktok: "تيك توك",
  google: "جوجل",
  whatsapp: "واتساب",
  snapchat: "سناب شات",
  other: "أخرى",
};

const MAP: Record<string, string> = { ا: "a", أ: "a", إ: "e", آ: "a", ب: "b", ت: "t", ث: "th", ج: "g", ح: "h", خ: "kh", د: "d", ذ: "z", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "k", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", ة: "a", و: "w", ي: "y", ى: "a", ئ: "e", ؤ: "o", ء: "" };

/** اسم الحملة ← رابط قصير لاتيني فريد بين حملات المتجر. */
export function campaignSlug(name: string, taken: string[]): string {
  const base =
    name
      .trim()
      .toLowerCase()
      .split("")
      .map((c) => MAP[c] ?? c)
      .join("")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "ad";
  const safe = /^[a-z0-9]/.test(base) && base.length >= 2 ? base : `ad-${base}`.replace(/-+$/, "");
  let slug = safe;
  for (let i = 2; taken.includes(slug); i++) slug = `${safe}-${i}`;
  return slug;
}

/** مسار الوجهة داخل المتجر مع UTM والكود. */
export function campaignDestination(c: Campaign): string {
  const path = c.target.type === "product" && c.target.slug ? `/p/${encodeURIComponent(c.target.slug)}` : c.target.type === "category" && c.target.slug ? `/c/${encodeURIComponent(c.target.slug)}` : "/";
  const q = new URLSearchParams({ utm_source: c.platform, utm_medium: "ad", utm_campaign: c.slug });
  if (c.code) q.set("promo", c.code);
  return `${path}?${q.toString()}`;
}

/** مصدر الطلب من كوكي الحملة، إن كانت الحملة ما زالت موجودة في المتجر. */
export function orderSourceFrom(cookie: string | null | undefined, campaigns: Campaign[]): string {
  const slug = (cookie ?? "").trim().toLowerCase();
  return slug && campaigns.some((c) => c.slug === slug) ? `campaign:${slug}` : "storefront";
}
