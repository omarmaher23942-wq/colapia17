// design-tweak.ts — «اكتبوا ما تريدون تغييره»: الواجهة العامة لمحرر الشكل والمحتوى بالوصف (التنفيذ في lib/design-edit/**)،
// واختيار وسائط واجهة المتجر. خالص (بلا خادم).
//  - schema-map.ts: خريطة كل ما يمكن تعديله مبنية آلياً من مخطط الـ Blueprint وقيمه الحالية.
//  - parse.ts: فهم مباشر للطلبات الشائعة (ألوان بالعربية والعامية والإنجليزية، أحجام، زوايا، أقسام، نصوص).
//  - apply.ts: التحقق من كل عملية بمخطط حقلها وحدوده، والتطبيق مع اشتقاق الأسطح وحارس التباين، والوصف العربي.
//  - plan.ts: دمج الفهم المباشر والموسّع في خطة بمعاينة «قبل/بعد».
import type { StoreBlueprint } from "@/blueprint/schema";

export { applyDesignOps, designOpSchema, designResponseSchema, summarizeEdit, type DesignOp, type EditResult } from "./design-edit/apply";
export { parseRequest, splitClauses, type ParseResult } from "./design-edit/parse";
export { planEdit, combineOps, type EditPlan } from "./design-edit/plan";
export { editableFields, mapForPrompt, type EditableField } from "./design-edit/schema-map";
export { previewTokens, type PreviewTokens } from "./design-edit/preview";
export { colorsIn, describeColor } from "./design-edit/colors";
export { SECTION_LABELS } from "./design-edit/labels";
export { DESIGN_SYSTEM_PROMPT, designUserPrompt } from "./design-edit/prompt";

/**
 * حالة شريط الإعلان كما يراها الزائر: المتجر يعرض شريط الهيدر (header.announcement) متى وُجد، وقسم الإعلان القديم في
 * الرئيسية لا يُعرض إلا إن لم يوجد شريط الهيدر (blueprint/core-migrate.ts). القراءة والكتابة من المصدر نفسه.
 */
export function announcementState(bp: StoreBlueprint): { text: string; enabled: boolean } {
  const h = bp.header.announcement;
  if (h) return { text: h.items[0]?.text ?? "", enabled: h.enabled !== false && h.items.length > 0 };
  const s = bp.home.find((x) => x.type === "announcement");
  return s && s.type === "announcement" ? { text: s.messages[0]?.text ?? "", enabled: s.enabled !== false } : { text: "", enabled: false };
}

/** يكتب شريط الإعلان في شريط الهيدر ويطفئ قسم الإعلان القديم حتى لا يعود نصه. */
export function withAnnouncement(bp: StoreBlueprint, text: string, enabled: boolean): StoreBlueprint {
  const cur = bp.header.announcement;
  const t = text.trim().slice(0, 120);
  return {
    ...bp,
    header: { ...bp.header, announcement: { enabled: enabled && !!t, items: t ? [{ ...(cur?.items[0] ?? {}), text: t }] : cur?.items ?? [], dismissible: cur?.dismissible ?? true, rotate: cur?.rotate ?? true } },
    home: bp.home.map((s) => (s.type === "announcement" ? { ...s, enabled: false } : s)),
  };
}

/** وسم سجل النسخ لتعديلات الوصف (يميزها في «آخر التعديلات»). */
export const EDIT_LABEL_PREFIX = "تعديل بالوصف: ";

// ─── واجهة المتجر: اختيار الوسائط ────────────────────────────────────────────
export type HeroMediaChoice =
  | { kind: "auto" }
  | { kind: "video_fashion" }
  | { kind: "video_electronics" }
  | { kind: "video_upload"; url: string; poster?: string }
  | { kind: "side_image"; url: string };

export const READY_VIDEOS = {
  video_fashion: { path: "/demo/media/hero-fashion.mp4", poster: "/demo/media/hero-fashion.jpg" },
  video_electronics: { path: "/demo/media/hero-electronics.mp4", poster: "/demo/media/hero-electronics.jpg" },
} as const;

/** يطبّق اختيار الوسائط على واجهة المتجر. origin = أصل المنصة التي تحمل الفيديوهات الجاهزة. */
export function applyHeroMedia(bp: StoreBlueprint, choice: HeroMediaChoice, origin: string, fallbackImages: { url: string; alt: string }[] = []): { blueprint: StoreBlueprint; summary: string } | { error: string } {
  const next: StoreBlueprint = structuredClone(bp);
  const hero = next.home.find((s) => s.type === "hero");
  if (!hero || hero.type !== "hero") return { error: "لا توجد واجهة في الصفحة الرئيسية" };
  const abs = (p: string) => `${origin.replace(/\/$/, "")}${p}`;
  const img = (url: string, alt: string) => ({ url, alt, focalX: 0.5, focalY: 0.4 });
  switch (choice.kind) {
    case "video_fashion":
    case "video_electronics": {
      const v = READY_VIDEOS[choice.kind];
      hero.videoUrl = abs(v.path);
      hero.images = [img(abs(v.poster), "")];
      hero.variant = "fullscreen";
      hero.overlayOpacity = Math.max(hero.overlayOpacity, 0.4);
      return { blueprint: next, summary: "ضبطنا فيديو الواجهة" };
    }
    case "video_upload": {
      if (!/^https:\/\//.test(choice.url)) return { error: "رابط الفيديو غير صالح" };
      hero.videoUrl = choice.url;
      if (choice.poster && /^https:\/\//.test(choice.poster)) hero.images = [img(choice.poster, "")];
      if (!hero.images.length) return { error: "أضيفوا صورة غلاف للفيديو ليظهر المتجر فوراً قبل تحميله" };
      hero.variant = "fullscreen";
      hero.overlayOpacity = Math.max(hero.overlayOpacity, 0.4);
      return { blueprint: next, summary: "ضبطنا فيديو الواجهة" };
    }
    case "side_image": {
      if (!/^https:\/\//.test(choice.url)) return { error: "رابط الصورة غير صالح" };
      hero.videoUrl = undefined;
      hero.images = [img(choice.url, "")];
      hero.variant = "split";
      return { blueprint: next, summary: "ضبطنا صورة الواجهة الجانبية" };
    }
    case "auto": {
      hero.videoUrl = undefined;
      const imgs = fallbackImages.filter((i) => /^https:\/\//.test(i.url)).slice(0, 4).map((i) => img(i.url, i.alt));
      hero.images = imgs;
      hero.variant = imgs.length >= 4 ? "collage" : imgs.length ? "split" : "centered";
      return { blueprint: next, summary: "الواجهة الآن تُبنى تلقائياً من منتجاتكم" };
    }
  }
}
