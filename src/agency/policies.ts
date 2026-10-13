// policies.ts — سياسات الدفع والشحن والاستبدال كما اختارها التاجر في الاستمارة، محوّلة إلى بيانات المتجر (منطق خالص بلا
// شبكة ولا قاعدة). المبدأ: ما قاله التاجر يُكتب كما هو (رقم المحفظة، إنستاباي، رسوم الشحن، مدة التوصيل، المعاينة)، وما لم
// يقله لا يُعلَن في المتجر ولا يُخترع (الضمان وسياسة العيوب تبقى مطفأة حتى يؤكدها الفريق معه).
import type { StoreBlueprint } from "@/blueprint/schema";
import { defaultShippingZones, GOVERNORATES } from "@/lib/egypt";
import { normalizeArabic } from "@/lib/arabic";
import { normalizeDigits, normalizeEgyptianPhone } from "@/lib/phone";
import type { IntakeData } from "@/intake/schema";

// ─── المحافظات من نص حر ─────────────────────────────────────────────────────

const GROUPS: Record<string, string[]> = {
  "القاهره الكبري": ["cairo", "giza", "qalyubia"],
  الدلتا: GOVERNORATES.filter((g) => g.group === "delta").map((g) => g.code),
  الصعيد: GOVERNORATES.filter((g) => g.group === "upper").map((g) => g.code),
  "مدن القناه": ["port_said", "ismailia", "suez"],
  القناه: ["port_said", "ismailia", "suez"],
  سيناء: ["north_sinai", "south_sinai"],
};

const ALIASES: Record<string, string[]> = {
  alexandria: ["اسكندريه", "الاسكندريه", "اسكندرية"],
  kafr_el_sheikh: ["كفر الشيخ", "كفرالشيخ"],
  port_said: ["بورسعيد", "بور سعيد"],
  beni_suef: ["بني سويف", "بنى سويف", "بني سويف"],
  new_valley: ["الوادي الجديد", "الوادى الجديد"],
  red_sea: ["البحر الاحمر", "الغردقه", "شرم الشيخ"],
  north_sinai: ["شمال سيناء", "العريش"],
  south_sinai: ["جنوب سيناء", "شرم الشيخ"],
};

/** رموز المحافظات المذكورة في نص التاجر («القاهرة والجيزة والإسكندرية»، «الصعيد»، «القاهرة الكبرى»…). */
export function governoratesIn(text: string | undefined | null): string[] {
  const t = normalizeArabic(text ?? "").replace(/[،,؛;/\\|+\-_()[\]{}.؟?!:]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return [];
  // يقبل «و» لاصقة قبل الاسم (والجيزة) و«ال» اختيارية، وحدود كلمة عربية حقيقية.
  const has = (name: string) => new RegExp(`(?:^|\\s)و?(?:${normalizeArabic(name).replace(/^ال/, "(?:ال)?")})(?=\\s|$)`).test(t);
  const found = new Set<string>();
  for (const [name, codes] of Object.entries(GROUPS)) if (has(name)) codes.forEach((c) => found.add(c));
  for (const g of GOVERNORATES) if ([g.name, ...(ALIASES[g.code] ?? [])].some(has)) found.add(g.code);
  return GOVERNORATES.map((g) => g.code).filter((c) => found.has(c));
}

// ─── مدة التوصيل ────────────────────────────────────────────────────────────

/** «من 2 إلى 4 أيام» → {min: 2, max: 4}؛ «يومين» → {2,2}؛ «3 أيام» → {3,3}؛ غير مفهوم → null. */
export function parseEtaDays(text: string | undefined | null): { min: number; max: number } | null {
  const t = normalizeArabic(normalizeDigits(text ?? ""));
  if (!t) return null;
  const nums = [...t.matchAll(/\d{1,2}/g)].map((m) => Number(m[0])).filter((n) => n >= 1 && n <= 30);
  if (nums.length >= 2) return { min: Math.min(nums[0]!, nums[1]!), max: Math.max(nums[0]!, nums[1]!) };
  if (nums.length === 1) return { min: nums[0]!, max: nums[0]! };
  const word = (w: string) => new RegExp(`(?<![\\u0600-\\u06FF])${w}(?![\\u0600-\\u06FF])`).test(t);
  if (word("يومين")) return { min: 2, max: 2 };
  if (word("يوم") || word("يوم واحد") || word("خلال يوم")) return { min: 1, max: 1 };
  return null;
}

// ─── الشحن ──────────────────────────────────────────────────────────────────

export type ZoneRow = { governorate: string; feePiasters: number; codExtraPiasters: number; etaMinDays: number; etaMaxDays: number; isActive: boolean };

/** صفوف مناطق الشحن: المفعّل حسب النطاق، والسعر الموحد (إن قاله التاجر)، والمدة (إن فُهمت). */
export function zoneRows(delivery: IntakeData["delivery"]): ZoneRow[] {
  const mentioned = delivery.scope === "custom" ? governoratesIn(delivery.note) : [];
  const eta = parseEtaDays(delivery.eta);
  return defaultShippingZones().map((z) => ({
    ...z,
    isActive:
      delivery.scope === "cairo_giza" ? z.governorate === "cairo" || z.governorate === "giza" : delivery.scope === "custom" && mentioned.length ? mentioned.includes(z.governorate) : true,
    ...(delivery.fee === "flat" && delivery.feeAmount ? { feePiasters: delivery.feeAmount * 100 } : {}),
    ...(eta ? { etaMinDays: eta.min, etaMaxDays: Math.max(eta.min, eta.max) } : {}),
  }));
}

/** هل فهمنا المحافظات من نص «محافظات معينة»؟ (وإلا تُفعَّل كلها ويُسأل التاجر في DELIVERY.md). */
export const customScopeUnderstood = (delivery: IntakeData["delivery"]) => delivery.scope !== "custom" || governoratesIn(delivery.note).length > 0;

export function shippingFromIntake(delivery: IntakeData["delivery"], inspectionAllowed: boolean, base: StoreBlueprint["shipping"]): StoreBlueprint["shipping"] {
  return {
    ...base,
    flatRatePiasters: delivery.fee === "flat" && delivery.feeAmount ? delivery.feeAmount * 100 : null,
    // «الشحن مجاني» = مجاني من أول جنيه (عتبة صفر)، ولا يُعلن مجاناً لمن لم يقلها.
    freeOverPiasters: delivery.fee === "free" ? 0 : null,
    generalEta: delivery.eta?.trim() ? delivery.eta.trim().slice(0, 80) : base.generalEta,
    inspectionAllowed,
  };
}

// ─── الدفع ──────────────────────────────────────────────────────────────────

const looksLikePhone = (s: string) => normalizeEgyptianPhone(s) !== null;

/** وسائل الدفع كما قالها التاجر: كل وسيلة بتفاصيلها، وما لم يختره معطَّل. لا رقم يُخترع. */
export function paymentsFromIntake(p: IntakeData["payment"], base: StoreBlueprint["payments"]): StoreBlueprint["payments"] {
  const has = (m: IntakeData["payment"]["methods"][number]) => p.methods.includes(m);
  const wallet = p.walletNumber ? normalizeEgyptianPhone(p.walletNumber) : null;
  const insta = p.instapayAddress?.trim() ?? "";
  const instaPhone = insta && looksLikePhone(insta) ? normalizeEgyptianPhone(insta) : null;
  const next: StoreBlueprint["payments"] = { ...base };
  // لم يختر أي وسيلة (طلبات قديمة): نترك الافتراضي كما هو.
  if (!p.methods.length) return next;
  next.cod = { ...base.cod, enabled: has("cod") };
  next.vodafoneCash = { ...base.vodafoneCash, enabled: has("wallet"), ...(has("wallet") && wallet ? { number: wallet } : {}) };
  next.instapay = {
    ...base.instapay,
    enabled: has("instapay"),
    ...(has("instapay") && insta
      ? instaPhone
        ? { number: instaPhone }
        : insta.includes("@") || /^[A-Za-z0-9._-]{3,}$/.test(insta)
          ? { address: insta.slice(0, 80) }
          : { holderName: insta.slice(0, 60) }
      : {}),
  };
  return next;
}

// ─── الاستبدال والاسترجاع ───────────────────────────────────────────────────

/** ما قاله التاجر فقط؛ الضمان وسياسة العيوب تبقى مطفأة (لم تُسأل). */
export function returnsFromIntake(r: IntakeData["returns"], base: StoreBlueprint["returns"]): StoreBlueprint["returns"] {
  const off = { ...base, windowDays: 0, allowExchange: false, allowRefund: false, defectPolicy: "none" as const };
  if (r.mode === "full" && r.days) return { ...off, windowDays: Math.min(60, r.days), allowExchange: true, allowRefund: true };
  if (r.mode === "exchange" && r.days) return { ...off, windowDays: Math.min(60, r.days), allowExchange: true, allowRefund: false };
  return off;
}
