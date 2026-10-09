// store-channels.ts — قنوات تواصل المتجر كما يراها العميل: مصدر واحد للهيدر والفوتر وقسم «تواصل معنا».
// كل قناة حفظها التاجر (من التسجيل أو الإعدادات) تظهر هنا برابطها الصحيح، ولا تظهر قناة غير محفوظة.
import type { StoreBlueprint } from "@/blueprint/schema";
import { waLink } from "./whatsapp";

export type SocialKey = "whatsapp" | "instagram" | "facebook" | "tiktok" | "messenger";
export type SocialLink = { key: SocialKey; href: string; label: string; handle: string };

const clean = (v?: string) => (v ?? "").trim().replace(/^@+/, "");

export function socialLinks(channels: StoreBlueprint["channels"]): SocialLink[] {
  const out: SocialLink[] = [];
  const wa = waLink(channels.whatsappNumber);
  if (wa && channels.whatsappNumber) out.push({ key: "whatsapp", href: wa, label: "واتساب", handle: channels.whatsappNumber });
  const ig = clean(channels.instagramUsername);
  if (ig) out.push({ key: "instagram", href: `https://instagram.com/${encodeURIComponent(ig)}`, label: "إنستجرام", handle: `@${ig}` });
  if (channels.facebookUrl) out.push({ key: "facebook", href: channels.facebookUrl, label: "فيسبوك", handle: facebookHandle(channels.facebookUrl) });
  const tt = clean(channels.tiktokUsername);
  if (tt) out.push({ key: "tiktok", href: `https://www.tiktok.com/@${encodeURIComponent(tt)}`, label: "تيك توك", handle: `@${tt}` });
  const ms = clean(channels.messengerPageUsername);
  if (ms) out.push({ key: "messenger", href: `https://m.me/${encodeURIComponent(ms)}`, label: "ماسنجر", handle: ms });
  return out;
}

/** «facebook.com/techbox.eg» ← اسم الصفحة للعرض. */
function facebookHandle(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean);
    if (seg[0] === "profile.php") return "صفحتنا";
    return seg[seg.length - 1] ?? "صفحتنا";
  } catch {
    return "صفحتنا";
  }
}
