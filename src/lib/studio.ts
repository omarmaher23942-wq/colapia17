// studio.ts — استوديو المحتوى: أنواع المحتوى ومخططات مخرجاتها وبناء التعليمات من بيانات المتجر الحقيقية، وفلتر صدق
// يُسقط أي نص يذكر رقماً (سعر، خصم، مدة) غير موجود في بيانات المتجر، أو يدّعي شيئاً عن أداة الكتابة (منطق خالص مختبَر).
import { z } from "zod";

export const STUDIO_KINDS = ["captions", "stories", "ad_copy", "product_post", "calendar"] as const;
export type StudioKind = (typeof STUDIO_KINDS)[number];

export const KIND_INFO: Record<StudioKind, { label: string; hint: string; needsProducts: boolean }> = {
  captions: { label: "تعليقات منشورات", hint: "ثلاثة تعليقات قصيرة جاهزة للنشر بنبرة المتجر.", needsProducts: true },
  stories: { label: "نصوص ستوري", hint: "ثلاث أفكار ستوري بنصوص قصيرة لكل شريحة.", needsProducts: true },
  ad_copy: { label: "نصوص إعلانية", hint: "عناوين ونصوص أساسية لإعلان ممول.", needsProducts: true },
  product_post: { label: "منشور منتج", hint: "منشور كامل لإبراز مزايا منتج واحد.", needsProducts: true },
  calendar: { label: "تقويم أسبوعي", hint: "خطة نشر لسبعة أيام من منتجاتكم.", needsProducts: false },
};

const text = (max: number) => z.string().trim().min(2).max(max);

export const captionsSchema = z.object({ items: z.array(z.object({ text: text(600), hashtags: z.array(z.string().trim().max(40)).max(8).default([]) })).min(1).max(5) });
export const storiesSchema = z.object({ items: z.array(z.object({ title: text(60), slides: z.array(text(120)).min(1).max(4) })).min(1).max(4) });
export const adCopySchema = z.object({ items: z.array(z.object({ headline: text(40), primary: text(300), cta: text(24) })).min(1).max(4) });
export const productPostSchema = z.object({ items: z.array(z.object({ text: text(900), hashtags: z.array(z.string().trim().max(40)).max(8).default([]) })).min(1).max(2) });
export const calendarSchema = z.object({
  days: z.array(z.object({ day: text(20), format: z.enum(["post", "story", "reel"]), idea: text(160), caption: text(500) })).min(3).max(7),
});

export const SCHEMAS = { captions: captionsSchema, stories: storiesSchema, ad_copy: adCopySchema, product_post: productPostSchema, calendar: calendarSchema } as const;

export type StudioProduct = { id: string; name: string; priceEgp: number; compareAtEgp: number | null; shortDescription: string | null; category: string | null; tags: string[] };
export type StudioFacts = { storeName: string; niche: string | null; facts: string[]; products: StudioProduct[]; url: string };

export const SYSTEM = [
  "أنت كاتب محتوى تسويقي لمتجر إلكتروني مصري. اكتب بالعربية الفصحى السلسة المناسبة لمنصات التواصل.",
  "قواعد لا تُكسر: استخدم فقط المعلومات المعطاة عن المتجر والمنتجات. لا تخترع خصومات أو أسعاراً أو مدد توصيل أو ضمانات أو كميات محدودة أو آراء عملاء.",
  "لا تذكر أرقاماً غير واردة في البيانات. لا تذكر أنك أداة أو ذكاء اصطناعي. لا تخاطب جنساً بعينه: استخدم صيغة الجمع أو المصدر (مثل: اطلبوا، تسوّقوا).",
  "اجعل النص قصيراً ومباشراً بلا مبالغة، وبنبرة تناسب نشاط المتجر. الإيموجي بحد أقصى واحد أو اثنين.",
].join("\n");

export function buildPrompt(kind: StudioKind, f: StudioFacts, chosen: StudioProduct[]): string {
  const list = (chosen.length ? chosen : f.products.slice(0, 8))
    .map((p) => `- ${p.name}: ${p.priceEgp} جنيه${p.compareAtEgp ? ` (قبل الخصم ${p.compareAtEgp})` : ""}${p.category ? ` · قسم ${p.category}` : ""}${p.shortDescription ? ` · ${p.shortDescription.slice(0, 140)}` : ""}`)
    .join("\n");
  const head = `المتجر: ${f.storeName}${f.niche ? ` (${f.niche})` : ""}\nالرابط: ${f.url}\n${f.facts.length ? `حقائق المتجر:\n${f.facts.map((x) => `- ${x}`).join("\n")}\n` : ""}المنتجات:\n${list}`;
  const task: Record<StudioKind, string> = {
    captions: "اكتب 3 تعليقات مختلفة لمنشورات إنستجرام تبرز المنتجات أعلاه، كل منها ينتهي بدعوة لطيفة لزيارة الرابط أو المراسلة، مع وسوم مناسبة.",
    stories: "اكتب 3 أفكار ستوري، لكل منها عنوان داخلي وشرائح من 1 إلى 3 نصوص قصيرة جداً (حتى 12 كلمة للشريحة).",
    ad_copy: "اكتب 3 صيغ إعلانية: عنوان حتى 40 حرفاً، ونص أساسي حتى 300 حرف، وزر دعوة قصير.",
    product_post: "اكتب منشوراً واحداً متكاملاً عن المنتج المختار يبرز مزاياه الحقيقية من بياناته فقط، مع وسوم.",
    calendar: "ضع خطة نشر لسبعة أيام (سبت إلى جمعة) تنوّع بين منشور وستوري وريلز من منتجات المتجر، ولكل يوم فكرة وتعليق جاهز.",
  };
  return `${head}\n\nالمطلوب: ${task[kind]}`;
}

/** كل الأعداد المسموحة في النص: أسعار المنتجات والحقائق والرابط (بالأرقام اللاتينية بعد التحويل). */
export function allowedNumbers(f: StudioFacts): Set<string> {
  const out = new Set<string>();
  const add = (s: string) => (toLatin(s).match(/\d+(?:[.,]\d+)?/g) ?? []).forEach((n) => out.add(n.replace(",", "")));
  for (const p of f.products) {
    out.add(String(p.priceEgp));
    if (p.compareAtEgp) out.add(String(p.compareAtEgp));
    add(p.name);
    add(p.shortDescription ?? "");
  }
  f.facts.forEach(add);
  add(f.url);
  add(f.storeName);
  return out;
}

export const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

const SELF = /ذكاء\s*اصطناعي|\bAI\b|chatgpt|gpt|نموذج لغوي|كُتب بواسطة/i;

/** هل النص مقبول؟ يرفض رقماً من خانتين فأكثر غير وارد في بيانات المتجر، ويرفض ذكر أداة الكتابة. السبعة أيام وأرقام الشرائح لا تُعد. */
export function isHonest(text: string, allowed: Set<string>): boolean {
  if (SELF.test(text)) return false;
  const nums = toLatin(text).match(/\d+(?:[.,]\d+)?/g) ?? [];
  return nums.every((n) => {
    const clean = n.replace(",", "");
    return clean.length < 2 || allowed.has(clean);
  });
}

/** يصفّي ناتج الكتابة من العناصر غير الصادقة (كل عنصر يُفحص بكل نصوصه). */
export function filterHonest<T>(items: T[], allowed: Set<string>): T[] {
  const strings = (v: unknown): string[] => (typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : []);
  return items.filter((it) => strings(it).every((s) => isHonest(s, allowed)));
}

export const descriptionSchema = z.object({ description: text(900), shortDescription: text(160) });

export function descriptionPrompt(f: StudioFacts, p: StudioProduct & { description: string | null }): string {
  return `المتجر: ${f.storeName}${f.niche ? ` (${f.niche})` : ""}\nالمنتج: ${p.name}\nالسعر: ${p.priceEgp} جنيه\nالوصف الحالي: ${p.description?.slice(0, 700) || "لا يوجد"}\nالوصف المختصر الحالي: ${p.shortDescription ?? "لا يوجد"}\n\nالمطلوب: حسّن وصف المنتج ليكون أوضح وأكثر إقناعاً دون إضافة أي مواصفة أو ميزة غير مذكورة أعلاه. فقرتان قصيرتان كحد أقصى (حتى 900 حرف)، ووصف مختصر حتى 160 حرفاً.`;
}
