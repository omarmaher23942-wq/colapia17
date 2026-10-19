// onboarding.ts — منطق «إعداد المتجر» الخالص (بلا تبعيات خادم): الخطوات وحالة التقدم المحفوظة في stores.onboarding،
// قوالب الشحن والاستبدال الجاهزة، ألوان الهوية وأزواج الخطوط، وفحص جاهزية التفعيل. يعمل في المتصفح (إرشاد فوري)
// وعلى الخادم (فحص نهائي قبل التفعيل) بالدالة نفسها، فلا يختلف ما يراه التاجر عما يُفرض.
import { buildFullPalette, contrastRatio, hexToHsl, hslToHex, readableOn } from "@/blueprint/palette";
import type { StoreBlueprint } from "@/blueprint/schema";
import { GOVERNORATES } from "@/lib/egypt";

// ─── الخطوات ────────────────────────────────────────────────────────────────

export const STEP_IDS = ["identity", "products", "look", "commerce", "publish"] as const;
export type StepId = (typeof STEP_IDS)[number];

export type StepInfo = { id: StepId; title: string; why: string; optional: boolean; short: string };

export const STEPS: readonly StepInfo[] = [
  { id: "identity", short: "المتجر", title: "اسم متجركم ونشاطكم", why: "الاسم أول ما يراه الزائر، ونوع النشاط يحدد الحقول المناسبة لمنتجاتكم. الشعار واللون اختياريان.", optional: false },
  { id: "products", short: "المنتجات", title: "منتجاتكم", why: "صوّروا المنتجات الآن بكاميرا الهاتف أو اختاروا صورها من المعرض، ونجهّز لكم الأسماء والأقسام لتراجعوها. السعر وحده تكتبونه أنتم.", optional: false },
  { id: "look", short: "الشكل", title: "شكل متجركم", why: "اختاروا تصميماً جاهزاً وشاهدوه مباشرة على متجركم، أو ابدؤوا من قالب مناسب لنشاطكم. يمكن تغيير أي شيء لاحقاً.", optional: true },
  { id: "commerce", short: "الدفع والشحن", title: "الدفع والشحن", why: "أسئلة قصيرة، سؤال في كل شاشة. أجيبوا بنعم أو لا، وما لا تريدونه يبقى مغلقاً.", optional: false },
  { id: "publish", short: "النشر", title: "نشر المتجر", why: "نراجع جاهزية متجركم معكم، ثم يبدأ العمل ويمكن لزبائنكم الطلب.", optional: false },
] as const;

/** معرّفات الخطوات القديمة (قبل الدمج في خمس خطوات) ← الخطوة التي حلّت محلها. */
const LEGACY_STEP: Record<string, StepId> = { payment: "commerce", shipping: "commerce", returns: "commerce", contact: "commerce", discount: "commerce" };

export const isStepId = (v: unknown): v is StepId => typeof v === "string" && (STEP_IDS as readonly string[]).includes(v);

export type OnboardingState = {
  step: StepId;
  done: StepId[];
  dmImages: string[];
  niche?: string;
  startedAt?: string;
};

/** يقرأ stores.onboarding (jsonb) بتسامح: أي حقل غريب يُهمل، والخطوة الأولى افتراضية. */
export function parseOnboarding(raw: unknown): OnboardingState {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const rawDone = Array.isArray(o.done) ? o.done.filter((x): x is string => typeof x === "string") : [];
  const done = [...new Set(rawDone.filter(isStepId))] as StepId[];
  // تقدّم محفوظ بالخطوات القديمة: «الدفع والشحن» منجزة متى أُنجزت الدفع والشحن والتواصل القديمة.
  if (!done.includes("commerce") && ["payment", "shipping", "contact"].every((x) => rawDone.includes(x))) done.push("commerce");
  const dmImages = Array.isArray(o.dmImages) ? o.dmImages.filter((u): u is string => typeof u === "string" && /^https:\/\//.test(u)).slice(0, 60) : [];
  const savedStep = typeof o.step === "string" ? (isStepId(o.step) ? o.step : LEGACY_STEP[o.step]) : undefined;
  return {
    step: savedStep ?? STEP_IDS.find((s) => !done.includes(s)) ?? "identity",
    done,
    dmImages,
    niche: typeof o.niche === "string" ? o.niche.slice(0, 80) : undefined,
    startedAt: typeof o.startedAt === "string" ? o.startedAt : undefined,
  };
}

/** يدمج تقدماً جديداً دون أن يمسح ما كتبه الوكيل (dmImages) أو غيره من الحقول. */
export function mergeProgress(prev: unknown, patch: { step?: StepId; markDone?: StepId; unmark?: StepId }): Record<string, unknown> {
  const base = prev && typeof prev === "object" && !Array.isArray(prev) ? { ...(prev as Record<string, unknown>) } : {};
  const cur = parseOnboarding(base);
  let done = cur.done;
  if (patch.markDone && !done.includes(patch.markDone)) done = [...done, patch.markDone];
  if (patch.unmark) done = done.filter((d) => d !== patch.unmark);
  return { ...base, step: patch.step ?? cur.step, done, startedAt: cur.startedAt ?? new Date().toISOString() };
}

export function nextStep(from: StepId): StepId {
  const i = STEP_IDS.indexOf(from);
  return STEP_IDS[Math.min(i + 1, STEP_IDS.length - 1)]!;
}
export function prevStep(from: StepId): StepId {
  const i = STEP_IDS.indexOf(from);
  return STEP_IDS[Math.max(i - 1, 0)]!;
}

/** نسبة التقدم 0..100: الخطوات المنجزة من غير خطوة التفعيل نفسها. */
export function progressPercent(done: readonly StepId[]): number {
  const countable = STEP_IDS.filter((s) => s !== "publish");
  const n = countable.filter((s) => done.includes(s)).length;
  return Math.round((n / countable.length) * 100);
}

// ─── الهوية: ألوان وخطوط ─────────────────────────────────────────────────────

export const BRAND_SWATCHES: readonly { hex: string; name: string }[] = [
  { hex: "#1f3a5f", name: "كحلي" },
  { hex: "#0f766e", name: "أخضر مزرق" },
  { hex: "#166534", name: "أخضر" },
  { hex: "#b45309", name: "عنبري" },
  { hex: "#be123c", name: "عنابي" },
  { hex: "#7c3aed", name: "بنفسجي" },
  { hex: "#1d4ed8", name: "أزرق" },
  { hex: "#111827", name: "أسود فاحم" },
] as const;

type FontKey = StoreBlueprint["theme"]["fonts"]["heading"];
export type FontPair = { id: string; name: string; sample: string; heading: FontKey; body: FontKey };

/** ثلاثة أزواج عربية مجرَّبة: الأول عصري محايد، الثاني أنيق للعلامات الراقية، الثالث ودود حيوي. */
export const FONT_PAIRS: readonly FontPair[] = [
  { id: "modern", name: "عصري هادئ", sample: "Cairo", heading: "cairo", body: "cairo" },
  { id: "elegant", name: "أنيق", sample: "المسيري والتجوال", heading: "el_messiri", body: "tajawal" },
  { id: "friendly", name: "ودود", sample: "Readex Pro", heading: "readex_pro", body: "almarai" },
] as const;

export const isHex = (v: string) => /^#([0-9a-f]{6})$/i.test(v);

/** يوحّد #abc و abc إلى #aabbcc صغيرة؛ null إن لم يكن لوناً. */
export function normalizeHex(v: string): string | null {
  const t = v.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(t)) return `#${t[0]}${t[0]}${t[1]}${t[1]}${t[2]}${t[2]}`;
  return /^[0-9a-f]{6}$/.test(t) ? `#${t}` : null;
}

/**
 * لوحة متجر كاملة من لون العلامة: خلفية بيضاء دافئة، اللون الأساسي هو علامتهم، واللون المميز مشتق منه بتدرج قريب.
 * كل الأزواج النصية تمر بتباين AA (buildFullPalette يضمن ذلك). الوضع الداكن اختياري.
 */
export function brandPalette(primary: string, dark = false): StoreBlueprint["theme"]["palette"] {
  const p = legible(normalizeHex(primary) ?? "#1f3a5f");
  const hsl = hexToHsl(p);
  const accent = legible(hslToHex({ h: (hsl.h + 28) % 360, s: Math.min(78, Math.max(42, hsl.s)), l: dark ? 62 : 46 }));
  const background = dark ? "#0f1115" : "#fbfaf8";
  const full = buildFullPalette(background, p, accent);
  return { ...full, primaryForeground: readableOn(p), accentForeground: readableOn(accent) };
}

/** لون تقرأ عليه نصوص الأزرار بتباين AA: يُعتّم (أو يُفتّح) تدريجياً حتى يبلغ 4.5 مع الأبيض أو الداكن. */
export function legible(hex: string): string {
  const ok = (c: string) => Math.max(contrastRatio(c, "#ffffff"), contrastRatio(c, "#0f172a")) >= 4.5;
  if (ok(hex)) return hex;
  const hsl = hexToHsl(hex);
  // اتجاه التعديل: الأقرب لنهاية القراءة (أفتح من 50% يُفتَّح للنص الداكن، وإلا يُعتَّم للنص الأبيض).
  const step = hsl.l > 50 ? 2 : -2;
  let l = hsl.l;
  for (let i = 0; i < 40 && !ok(hslToHex({ ...hsl, l })); i++) l = Math.min(100, Math.max(0, l + step));
  return hslToHex({ ...hsl, l });
}

// ─── الشحن: قوالب ───────────────────────────────────────────────────────────

export type ShippingPlan =
  | { kind: "flat"; fee: number }
  | { kind: "cairo_giza"; cairoFee: number; restFee: number }
  | { kind: "custom"; groups: Record<"gc" | "alex" | "delta" | "canal" | "upper" | "remote", number | null> };

export const SHIPPING_GROUP_LABEL: Record<"gc" | "alex" | "delta" | "canal" | "upper" | "remote", string> = {
  gc: "القاهرة الكبرى",
  alex: "الإسكندرية",
  delta: "الدلتا",
  canal: "القناة",
  upper: "الصعيد",
  remote: "سيناء والمحافظات الحدودية",
};

export type ZoneRow = { governorate: string; fee: number; codExtra: number; etaMin: number; etaMax: number; isActive: boolean };

/** يبني صفوف المحافظات الـ27 من القالب. "custom": مجموعة بلا سعر = غير مخدومة. */
export function zonesFromPlan(plan: ShippingPlan, eta: { min: number; max: number }, codExtra = 0): ZoneRow[] {
  const etaMin = Math.max(0, eta.min);
  const etaMax = Math.max(etaMin, eta.max);
  return GOVERNORATES.map((g) => {
    let fee: number | null;
    if (plan.kind === "flat") fee = plan.fee;
    else if (plan.kind === "cairo_giza") fee = g.code === "cairo" || g.code === "giza" ? plan.cairoFee : plan.restFee;
    else fee = plan.groups[g.group];
    return { governorate: g.code, fee: fee ?? 0, codExtra, etaMin, etaMax, isActive: fee !== null };
  });
}

/** «القاهرة والجيزة + سعر للباقي»: كل المحافظات مخدومة، ويُعرض السعران. */
export const etaText = (min: number, max: number): string => (min === max ? `${max} ${max <= 10 ? "أيام" : "يوماً"} عمل` : `من ${min} إلى ${max} أيام عمل`);

// ─── الاستبدال: قوالب ───────────────────────────────────────────────────────

export type ReturnsTemplate = { kind: "none" } | { kind: "exchange"; days: number; paidBy: StoreBlueprint["returns"]["returnShippingPaidBy"] } | { kind: "exchange_refund"; days: number; paidBy: StoreBlueprint["returns"]["returnShippingPaidBy"] };

export function returnsFromTemplate(t: ReturnsTemplate, prev: StoreBlueprint["returns"]): StoreBlueprint["returns"] {
  if (t.kind === "none") return { ...prev, windowDays: 0, allowExchange: false, allowRefund: false };
  const days = Math.min(60, Math.max(1, Math.round(t.days)));
  return { ...prev, windowDays: days, allowExchange: true, allowRefund: t.kind === "exchange_refund", returnShippingPaidBy: t.paidBy };
}

/** يقرأ الـ Blueprint الحالي ويعيده كقالب (لإعادة عرض اختيار التاجر عند الرجوع للخطوة). */
export function templateFromReturns(r: StoreBlueprint["returns"]): ReturnsTemplate {
  if (r.windowDays === 0 || (!r.allowExchange && !r.allowRefund)) return { kind: "none" };
  return r.allowRefund ? { kind: "exchange_refund", days: r.windowDays, paidBy: r.returnShippingPaidBy } : { kind: "exchange", days: r.windowDays, paidBy: r.returnShippingPaidBy };
}

// ─── جاهزية التفعيل ─────────────────────────────────────────────────────────

export type ReadinessFacts = {
  /** منتجات منشورة بسعر أكبر من صفر. */
  activePricedProducts: number;
  /** منتجات بلا سعر (مسودات). */
  draftProducts: number;
  payments: StoreBlueprint["payments"];
  activeZones: number;
  whatsapp: string | null | undefined;
  /** الحد الأدنى للأسماء: اسم المتجر غير فارغ. */
  storeName: string;
};

export type ReadinessItem = { id: "products" | "payment" | "shipping" | "contact" | "identity"; ok: boolean; label: string; hint: string; step: StepId };

/** هل وسيلة دفع واحدة على الأقل مكتملة؟ وسيلة مفعّلة بلا رقم لا تُحسب. */
export function paymentMethodsReady(p: StoreBlueprint["payments"]): { cod: boolean; vodafone: boolean; instapay: boolean; any: boolean; incomplete: string[] } {
  const cod = Boolean(p.cod.enabled);
  const vodafone = Boolean(p.vodafoneCash.enabled && p.vodafoneCash.number);
  const instapay = Boolean(p.instapay.enabled && (p.instapay.address || p.instapay.number));
  const incomplete: string[] = [];
  if (p.vodafoneCash.enabled && !p.vodafoneCash.number) incomplete.push("فودافون كاش");
  if (p.instapay.enabled && !(p.instapay.address || p.instapay.number)) incomplete.push("إنستاباي");
  return { cod, vodafone, instapay, any: cod || vodafone || instapay, incomplete };
}

export function publishReadiness(f: ReadinessFacts): { ok: boolean; items: ReadinessItem[]; blockers: ReadinessItem[] } {
  const pay = paymentMethodsReady(f.payments);
  const items: ReadinessItem[] = [
    {
      id: "identity",
      ok: f.storeName.trim().length > 0,
      label: "اسم المتجر",
      hint: "اكتبوا اسم متجركم في الخطوة الأولى.",
      step: "identity",
    },
    {
      id: "products",
      ok: f.activePricedProducts >= 1,
      label: "منتج واحد على الأقل بسعر",
      hint: f.draftProducts > 0 ? `لديكم ${f.draftProducts} منتج بلا سعر. أضيفوا سعراً لواحد منها على الأقل ليظهر في المتجر.` : "أضيفوا منتجاً واحداً على الأقل بسعره.",
      step: "products",
    },
    {
      id: "payment",
      ok: pay.any && pay.incomplete.length === 0,
      label: "وسيلة دفع مكتملة",
      hint: pay.incomplete.length ? `أكملوا بيانات ${pay.incomplete.join(" و")} أو أوقفوها.` : "فعّلوا وسيلة دفع واحدة على الأقل.",
      step: "commerce",
    },
    {
      id: "shipping",
      ok: f.activeZones >= 1,
      label: "الشحن مضبوط",
      hint: "اختاروا قالب الشحن ليعرف الزبون سعر التوصيل.",
      step: "commerce",
    },
    {
      id: "contact",
      ok: Boolean(f.whatsapp),
      label: "رقم واتساب",
      hint: "أضيفوا رقم واتساب المتجر ليصلكم الزبائن ويصلكم تأكيد الطلبات.",
      step: "commerce",
    },
  ];
  const blockers = items.filter((i) => !i.ok);
  return { ok: blockers.length === 0, items, blockers };
}

/** أسئلة «الدفع والشحن» بالترتيب: المعاينة تُسأل فقط مع الدفع عند الاستلام. */
export type CommerceQuestion = "cod" | "inspection" | "transfer" | "whatsapp" | "shipping" | "returns" | "gift" | "cancel" | "discount";
export function commerceQuestions(cod: boolean): CommerceQuestion[] {
  return ["cod", ...(cod ? (["inspection"] as const) : []), "transfer", "whatsapp", "shipping", "returns", "gift", "cancel", "discount"];
}

/** يستنتج قالب الشحن من صفوف المحافظات المحفوظة ليعرضه المعالج عند الرجوع للخطوة. null = لم يُضبط بعد. */
export function planFromZones(
  zones: { governorate: string; feePiasters: number; isActive: boolean; etaMinDays: number; etaMaxDays: number }[],
  flatRatePiasters: number | null
): { plan: ShippingPlan; etaMin: number; etaMax: number } | null {
  if (!zones.length) return null;
  const active = zones.filter((z) => z.isActive);
  const etaMin = Math.min(...(active.length ? active : zones).map((z) => z.etaMinDays));
  const etaMax = Math.max(...(active.length ? active : zones).map((z) => z.etaMaxDays));
  if (flatRatePiasters !== null) return { plan: { kind: "flat", fee: flatRatePiasters / 100 }, etaMin, etaMax };
  const fee = (code: string) => zones.find((z) => z.governorate === code)?.feePiasters;
  const others = active.filter((z) => z.governorate !== "cairo" && z.governorate !== "giza");
  const restFees = new Set(others.map((z) => z.feePiasters));
  if (fee("cairo") === fee("giza") && fee("cairo") !== undefined && restFees.size === 1 && active.length === zones.length) {
    return { plan: { kind: "cairo_giza", cairoFee: fee("cairo")! / 100, restFee: [...restFees][0]! / 100 }, etaMin, etaMax };
  }
  const groups = { gc: null, alex: null, delta: null, canal: null, upper: null, remote: null } as Record<"gc" | "alex" | "delta" | "canal" | "upper" | "remote", number | null>;
  for (const g of GOVERNORATES) {
    const z = zones.find((x) => x.governorate === g.code);
    if (z?.isActive && groups[g.group] === null) groups[g.group] = z.feePiasters / 100;
  }
  return { plan: { kind: "custom", groups }, etaMin, etaMax };
}

/** كل ما تحتاجه صفحة الإعداد من الخادم عند الفتح (يُحمّل حياً من بيانات المتجر، لا من مسودة). */
export type SetupData = {
  store: { id: string; name: string; subdomain: string; url: string; host: string };
  onboarding: OnboardingState;
  identity: { name: string; primary: string; fontPair: string; logoUrl: string | null };
  products: { total: number; active: number; drafts: number; categories: string[] };
  payments: {
    cod: boolean;
    inspection: boolean;
    codFee: number;
    vodafone: { enabled: boolean; number: string; holder: string };
    instapay: { enabled: boolean; target: string; holder: string };
  };
  shipping: { plan: ShippingPlan; etaMin: number; etaMax: number; freeOver: number | null; saved: boolean };
  returns: ReturnsTemplate;
  /** خيارات إضافية لا تُفعَّل إلا بإجابة صريحة من التاجر: الأصل «لا». */
  extras: { gift: boolean; giftFeePounds: number; customerCancel: boolean };
  contact: { whatsapp: string; instagram: string; facebook: string; tiktok: string };
  look: { heroKind: "video" | "image" | "auto"; hasVideo: boolean; videoUrl: string | null; themeId: string | null; templateId: string | null };
  /** نشاط المتجر الذي تتبعه حقول المنتج (lib/niche-attributes). */
  niche: import("@/lib/niche-attributes").Niche;
  discounts: number;
  readiness: { ok: boolean; items: ReadinessItem[] };
};

/** يطابق الخط الحالي (heading/body) بأحد الأزواج الجاهزة، وإلا الأول. */
export function pairIdFor(heading: string, body: string): string {
  return (FONT_PAIRS.find((p) => p.heading === heading && p.body === body) ?? FONT_PAIRS.find((p) => p.heading === heading) ?? FONT_PAIRS[0]!).id;
}

/**
 * خطوط المتجر بعد حفظ الهوية. الاختيار المعروض في النموذج مشتق من الخطوط الحالية (pairIdFor)، وخطوط التصميمات الثمانية أو
 * ما كتبه التاجر بالوصف قد لا تطابق أي زوج في القائمة فيعرض النموذج أول زوج. لذلك لا نغيّر الخطوط إلا إن اختار التاجر
 * زوجاً مختلفاً عما يظهر له، وإلا كان حفظ الاسم وحده يستبدل خطوط التصميم بالزوج الأول بصمت.
 */
export function fontsAfterIdentity<T extends string>(current: { heading: T; body: T }, submittedPairId: string): { heading: T; body: T } {
  if (submittedPairId === pairIdFor(current.heading, current.body)) return { heading: current.heading, body: current.body };
  const pair = FONT_PAIRS.find((f) => f.id === submittedPairId);
  return pair ? { heading: pair.heading as T, body: pair.body as T } : { heading: current.heading, body: current.body };
}

/** تباين اللون الأساسي على الأبيض (لتحذير لطيف من لون باهت جداً). */
export function brandContrast(primary: string): number {
  const p = normalizeHex(primary);
  return p ? contrastRatio(p, "#ffffff") : 0;
}
