// draft.ts — المسودة الأولى للمتجر من بيانات الطلب (منطق خالص بلا ذكاء اصطناعي ولا شبكة): Blueprint بالاسم والنشاط
// والألوان والقنوات، وseed.json من أسطر المنتجات، وملفات stores/<slug>/ التي يبدأ منها المنفّذ. لا تخترع شيئاً: منتج
// بلا سعر لا يدخل seed ويُكتب سؤالاً في DELIVERY.md، وما تركه العميل للفريق يبقى بالقيم الافتراضية.
import { defaultBlueprint } from "@/blueprint/defaults";
import type { StoreBlueprint } from "@/blueprint/schema";
import { storeSeedSchema, type SeedProduct, type StoreSeed } from "@/stores/seed";
import { paletteById } from "@/intake/palettes";
import { handleFromSocial } from "./slug";
import type { IntakeData } from "@/intake/schema";

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[٬,](?=\d{3}\b)/g, "");

const SIZE_TOKEN = /^(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|\d{2}|\d{1,2}\s*-\s*\d{1,2}|free|فري ?سايز)$/i;
const PRICE_HINT = /(ج\.?م|جنيه|جنية|ج|le|egp|£)/i;

export type ParsedLine = { name: string; price: number | null; options?: Record<string, string[]>; note?: string };

/**
 * يحلل سطر منتج كتبه التاجر: «تيشيرت قطن، أسود/أبيض، M L XL، 350». الاسم = أول جزء. السعر = آخر رقم منفرد (أو
 * بجواره «جنيه/ج»). الألوان = جزء مفصول بـ / أو «و». المقاسات = جزء كل كلماته مقاسات. الباقي يصبح وصفاً.
 */
export function parseProductLine(raw: string): ParsedLine {
  const parts = toLatin(raw)
    .split(/[،,؛;|]|\s-\s/)
    .map((p) => p.trim())
    .filter(Boolean);
  const name = (parts.shift() ?? "").slice(0, 120);
  let price: number | null = null;
  const options: Record<string, string[]> = {};
  const rest: string[] = [];

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]!;
    const m = p.match(/^(?:بـ?\s*|سعر(?:ه)?\s*:?\s*)?(\d{1,7}(?:\.\d{1,2})?)\s*(ج\.?م|جنيه|جنية|ج|le|egp|£)?$/i);
    if (price === null && m && (m[2] || i === parts.length - 1)) {
      price = Number(m[1]);
      parts.splice(i, 1);
      break;
    }
  }
  for (const p of parts) {
    const tokens = p.split(/\s+/).filter(Boolean);
    if (tokens.length && tokens.every((t) => SIZE_TOKEN.test(t)) && !options["المقاس"]) {
      options["المقاس"] = tokens.map((t) => t.toUpperCase()).slice(0, 20);
    } else if (/[/\\]|\sو\s?/.test(p) && !options["اللون"] && !/\d/.test(p) && !PRICE_HINT.test(p)) {
      const vals = p.split(/\s*[/\\]\s*|\sو\s?/).map((v) => v.trim()).filter((v) => v.length >= 2 && v.length <= 30);
      if (vals.length >= 2) options["اللون"] = vals.slice(0, 20);
      else rest.push(p);
    } else rest.push(p);
  }
  return { name, price: price && price > 0 ? price : null, ...(Object.keys(options).length ? { options } : {}), ...(rest.length ? { note: rest.join("، ").slice(0, 400) } : {}) };
}

export type DraftInput = { slug: string; code: string; data: IntakeData; imageUrl: (key: string | undefined) => string | null };

export type Draft = { blueprint: StoreBlueprint; seed: StoreSeed; missingPrice: string[] };

export function buildDraft({ slug, data: d, imageUrl }: DraftInput): Draft {
  const name = d.store.name?.trim() || slug;
  const palette = d.colors.mode === "preset" ? paletteById(d.colors.preset) : null;
  const colorPreference = palette ? palette.colors.join(" ") : d.colors.mode === "custom" ? d.colors.custom : undefined;
  const social = d.social.url ?? "";
  const handle = /instagram\.com/i.test(social) ? handleFromSocial(social) : null;
  const products: SeedProduct[] = [];
  const missingPrice: string[] = [];

  for (const it of d.products.mode === "list" ? d.products.items : []) {
    if (!it.line?.trim()) continue;
    const p = parseProductLine(it.line);
    if (!p.name || p.name.length < 2) continue;
    if (p.price === null) {
      missingPrice.push(it.line.trim());
      continue;
    }
    const img = imageUrl(it.key);
    products.push({ name: p.name, price: p.price, images: img ? [img] : [], featured: products.length < 4, ...(p.options ? { options: p.options } : {}), ...(p.note ? { description: p.note } : {}) });
  }

  const bp = defaultBlueprint({
    name,
    tagline: d.store.oneLine,
    instagramUsername: handle ?? undefined,
    facebookUrl: /facebook\.com/i.test(social) ? social : undefined,
    whatsappNumber: d.contact.whatsapp,
    email: d.contact.email,
    colorPreference,
    hasLogo: Boolean(d.logo.key),
    productCount: products.length,
    variationSeed: `agency-${slug}`,
  });
  const logo = imageUrl(d.logo.key);
  if (logo) bp.brand = { ...bp.brand, logo: { url: logo, alt: name, focalX: 0.5, focalY: 0.5 } };
  // العميل اختار وسائل دفع ليس منها الاستلام: لا نعرض الاستلام. أرقام المحافظ يضيفها الفريق بعد سؤاله (لا نخترعها).
  if (d.payment.methods.length && !d.payment.methods.includes("cod")) bp.payments = { ...bp.payments, cod: { ...bp.payments.cod, enabled: false } };

  // سياسات لم يقلها العميل لا تُعلن: الاستبدال والضمان ومعاينة الشحنة تبقى مطفأة حتى يؤكدها الفريق معه (أسئلة في
  // DELIVERY.md)، فلا تظهر شارة أو سؤال شائع يعد بشيء لم يعد به التاجر.
  bp.returns = { ...bp.returns, windowDays: 0, allowExchange: false, allowRefund: false, defectPolicy: "none" };
  bp.shipping = { ...bp.shipping, inspectionAllowed: false };

  return { blueprint: bp, seed: storeSeedSchema.parse({ categories: [], products }), missingPrice };
}

/** ملفات stores/<slug>/ التي يبدأ منها المنفّذ (تُكتب في فرع GitHub أو تُنزَّل ZIP). */
export function storeFolderFiles(input: { slug: string; code: string; name: string; brief: string; draft: Draft; assets: { kind: string; url: string }[] }): Record<string, string> {
  const base = `stores/${input.slug}`;
  const delivery = [
    `# DELIVERY — ${input.name}`,
    "",
    `> طلب ${input.code}. أنشأ التجهيز الآلي هذا المجلد بمسودة أولى من الاستمارة فقط: راجع كل شيء وحسّنه حتى معيار QUALITY.md.`,
    "",
    "## الفهم",
    "- الزبون المستهدف:",
    "- لماذا يشتري:",
    "- الإحساس المطلوب:",
    "",
    "## أسئلة للعميل",
    ...input.draft.missingPrice.map((l) => `- سعر هذا المنتج غير مذكور: «${l.replace(/\s+/g, " ").slice(0, 160)}»`),
    "- سياسة الاستبدال والاسترجاع (المدة ومن يتحمل الشحن) وضمان العيوب: مطفأة في المسودة حتى يؤكدها العميل.",
    "- هل يسمح بمعاينة الشحنة قبل الدفع؟ (مطفأة في المسودة)",
    "- أسعار ومدد الشحن لكل محافظة (المسودة بالقيم الافتراضية).",
    "- أرقام فودافون كاش / إنستاباي إن اختارها للدفع.",
    "",
    "## ما تغيّر",
    "",
    "## النتيجة على QUALITY.md",
    "",
    "## تعديل نواة يحتاج اعتماد المالك",
    "- (لا شيء)",
    "",
  ].join("\n");
  return {
    [`${base}/store.json`]: `${JSON.stringify({ slug: input.slug, name: input.name }, null, 2)}\n`,
    [`${base}/BRIEF.md`]: `${input.brief.trim()}\n`,
    [`${base}/blueprint.json`]: `${JSON.stringify(input.draft.blueprint, null, 2)}\n`,
    [`${base}/seed.json`]: `${JSON.stringify(input.draft.seed, null, 2)}\n`,
    [`${base}/theme.css`]: `/* جلد ${input.name}: كل قاعدة تبدأ بـ .storefront (stores/CLAUDE.md القسم 2). */\n`,
    [`${base}/DELIVERY.md`]: delivery,
    [`${base}/brief/assets.json`]: `${JSON.stringify(input.assets, null, 2)}\n`,
  };
}
