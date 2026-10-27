// provision-plan.ts — الأجزاء الخالصة لتجهيز متجر من «طلب بناء» الوكيل (V5 N6): اختيار النطاق، المظهر من إجابة الذوق،
// مخطط افتراضي صادق، مناطق الشحن من نص البيع، وسياسة المعاينة. لا قاعدة بيانات هنا. التنفيذ في provision.ts.
import { blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";
import { defaultBlueprint } from "@/blueprint/defaults";
import { applyTheme, DEFAULT_THEME, type ThemeId } from "@/blueprint/themes";
import { defaultShippingZones } from "@/lib/egypt";
import { isValidSubdomain } from "@/lib/subdomains";
import type { BuildData } from "@/agent/build-request";
import { feesFromNote, governoratesIn, parseEtaDays, type ZoneRow } from "./policies";
import { suggestSlug } from "./slug";

export type SlugVerdict = { ok: true; slug: string } | { ok: false; error: string };

/** النطاق المطلوب: صالح وغير محجوز وغير مأخوذ، وإلا خطأ بالعربية. بلا طلب يُقترح من الاسم/إنستجرام/الكود. */
export function chooseSlug(
  input: { requested?: string | null; storeName?: string | null; instagram?: string | null; email?: string | null; code: string },
  taken: (s: string) => boolean
): SlugVerdict {
  const req = input.requested?.trim().toLowerCase();
  if (req) {
    if (!isValidSubdomain(req)) return { ok: false, error: "النطاق غير صالح أو محجوز. استخدموا حروفاً لاتينية صغيرة وأرقاماً وشرطات." };
    if (taken(req)) return { ok: false, error: "النطاق مستخدم لمتجر آخر. غيّروه ثم أعيدوا التجهيز." };
    return { ok: true, slug: req };
  }
  return { ok: true, slug: suggestSlug({ storeName: input.storeName, socialUrl: input.instagram, email: input.email, code: input.code }, taken) };
}

const THEME_HINTS: [ThemeId, RegExp][] = [
  ["noir-gold", /(ذهب|فخم|فاخر|لوكس|اسود|أسود|luxury|gold|black|noir)/i],
  ["ivory-atelier", /(انيق|أنيق|كلاسيك|عاج|كريمي|بيج|classic|elegant|ivory)/i],
  ["coral-pop", /(مرح|كورال|وردي|شبابي|ملون|pop|pink|coral|fun)/i],
  ["sage-minimal", /(بسيط|هادي|هادئ|اخضر|أخضر|طبيعي|minimal|simple|green|sage)/i],
  ["neon-tech", /(تقني|تكنولوجيا|نيون|الكترون|إلكترون|gaming|tech|neon)/i],
  ["desert-sand", /(رملي|صحراء|ترابي|دافئ|sand|desert|warm)/i],
  ["arctic-glass", /(ازرق فاتح|أزرق فاتح|زجاج|ثلج|بارد|glass|ice|arctic)/i],
  ["midnight-mercury", /(كحلي|ليلي|داكن|غامق|navy|dark|midnight)/i],
];

/** المظهر من إجابة الذوق الحرة؛ بلا مؤشر واضح = التصميم الافتراضي. */
export function themeFromStyle(text: string | null | undefined): ThemeId {
  const t = (text ?? "").trim();
  if (!t) return DEFAULT_THEME;
  return THEME_HINTS.find(([, re]) => re.test(t))?.[0] ?? DEFAULT_THEME;
}

const igHandle = (url: string | null | undefined) => {
  const m = (url ?? "").match(/instagram\.com\/([A-Za-z0-9._]+)/i) ?? (url ?? "").match(/^@?([A-Za-z0-9._]{2,30})$/);
  return m?.[1];
};

/** مخطط افتراضي صادق من إجابات الطلب: الاسم والنشاط والتواصل فقط، بقالب المنصة وهوية من الذوق. لا وعود ولا أرقام مخترعة. */
export function blueprintFromRequest(d: BuildData): StoreBlueprint {
  const name = d.identity.storeName.trim() || "متجري";
  const bp = defaultBlueprint({
    name,
    industry: d.identity.niche ?? undefined,
    instagramUsername: igHandle(d.identity.instagram),
    whatsappNumber: d.contact.whatsapp ?? undefined,
    email: d.contact.email ?? undefined,
    variationSeed: name,
  });
  return blueprintSchema.parse(applyTheme(bp, themeFromStyle(d.look.text)));
}

/** مناطق الشحن من نص البيع الحر: المحافظات المذكورة تُفعَّل وحدها (وإلا الكل)، وأسعار المحافظات إن فُهمت، والمدة إن ذُكرت. */
export function zonesFromSelling(text: string | null | undefined): ZoneRow[] {
  const mentioned = governoratesIn(text);
  const fees = feesFromNote(text);
  const eta = parseEtaDays(text);
  return defaultShippingZones().map((z) => {
    const fee = fees.byGov.get(z.governorate) ?? fees.rest ?? undefined;
    return {
      ...z,
      isActive: mentioned.length ? mentioned.includes(z.governorate) : true,
      ...(fee !== undefined ? { feePiasters: fee } : {}),
      ...(eta ? { etaMinDays: eta.min, etaMaxDays: Math.max(eta.min, eta.max) } : {}),
    };
  });
}

export type ProvisionSource = "folder" | "default";

/** مجلد الفريق (مخطط أو بذور صالحة) ثم المخطط الافتراضي. */
export const pickSource = (folder: { blueprint: unknown; seed: unknown }): ProvisionSource => (folder.blueprint || folder.seed ? "folder" : "default");

/** الإنتاج بعد التجهيز: مجلد مبني = للمراجعة، وإلا قيد التجهيز (الفريق يكمله). */
export const productionAfterProvision = (source: ProvisionSource): "review" | "building" => (source === "folder" ? "review" : "building");

export function isBuildData(v: unknown): v is BuildData {
  const o = v as BuildData | null;
  return Boolean(o && typeof o === "object" && o.v === 5 && o.identity && o.contact && o.look && o.selling);
}
