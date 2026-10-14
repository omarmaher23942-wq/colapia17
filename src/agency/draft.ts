// draft.ts — المسودة الأولى للمتجر من بيانات الطلب (منطق خالص بلا ذكاء اصطناعي ولا شبكة): Blueprint بالاسم والنشاط
// والألوان والقنوات، وseed.json من أسطر المنتجات، وملفات stores/<slug>/ التي يبدأ منها المنفّذ. لا تخترع شيئاً: منتج
// بلا سعر لا يدخل seed ويُكتب سؤالاً في DELIVERY.md، وما تركه العميل للفريق يبقى بالقيم الافتراضية.
import { defaultBlueprint } from "@/blueprint/defaults";
import type { StoreBlueprint } from "@/blueprint/schema";
import { storeSeedSchema, type SeedProduct, type StoreSeed } from "@/stores/seed";
import { paletteById } from "@/intake/palettes";
import { handleFromSocial } from "./slug";
import type { IntakeData } from "@/intake/schema";
import { normalizeArabic } from "@/lib/arabic";
import { paymentsFromIntake, returnsFromIntake, shippingFromIntake, customScopeUnderstood, feeNoteUnderstood } from "./policies";

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[٬,](?=\d{3}\b)/g, "");

// ألوان شائعة (تُقرأ بعد توحيد الهمزات والتاء). الاسم الإنجليزي يُقبل أيضاً.
const COLOR_WORDS = [
  "اسود", "ابيض", "احمر", "ازرق", "اخضر", "اصفر", "برتقالي", "بنفسجي", "وردي", "رمادي", "بني", "بيج", "كحلي", "نبيتي", "عنابي", "زيتي",
  "سماوي", "لبني", "ذهبي", "فضي", "كاكي", "خمري", "جملي", "فيروزي", "تركواز", "موف", "ليلكي", "بينك", "كريمي", "سكري", "رصاصي", "فحمي", "خردلي",
  "زهري", "نيلي", "black", "white", "red", "blue", "green", "yellow", "pink", "grey", "gray", "beige", "navy", "brown", "olive",
];
const COLOR_SET = new Set(COLOR_WORDS.map(normalizeArabic));
const SIZE_LETTER = /(?<![A-Za-z])(xxxl|4xl|3xl|2xl|xxl|xl|xs|s|m|l)(?![A-Za-z])/gi;
const NUM = "(\\d{1,7}(?:\\.\\d{1,2})?)";
const CUR = "(?:ج\\.?م|ج\\.?|جنيه|جنية|جنيها|le|egp|£)";
// أول ما يطابق يحسم: علامة سعر صريحة، ثم رقم بعملة، ثم عملة قبل الرقم.
const PRICE_RES: RegExp[] = [
  new RegExp(`(?:^|\\s)(?:السعر|سعر(?:ه|ها|ة)?|بسعر)\\s*:?\\s*${NUM}(?:\\s*${CUR}(?![\\p{L}]))?`, "iu"),
  new RegExp(`(?:^|\\s)ب[ـ]?\\s?${NUM}(?:\\s*${CUR}(?![\\p{L}]))?(?!\\d)`, "iu"),
  new RegExp(`${NUM}\\s*${CUR}(?![\\p{L}])`, "iu"),
  new RegExp(`(?:جنيه|egp|le|£)\\s*:?\\s*${NUM}`, "iu"),
];
const NAME_CUT = /\s(?=(?:مقاس(?:ات)?|سايز|sizes?|لون(?:ه)?|الوان|ألوان|اللون|السعر|سعر(?:ه|ها)?|بسعر|متوفر\S*|متاح\S*|خامه|خامة|الخامه|الخامة|\d))/i;

export type ParsedLine = { name: string; price: number | null; options?: Record<string, string[]>; note?: string };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * يحلل كلام التاجر عن منتج (نص حر: «تيشيرت قطن أسود وأبيض مقاسات M L XL السعر 350 جنيه» أو أسطر وفواصل) إلى مسودة:
 * الاسم = البداية حتى أول علامة (مقاس/لون/سعر/رقم)، السعر من علامة صريحة أو رقم بعملة أو آخر رقم يبدو سعراً،
 * الألوان من الأسماء المعروفة، المقاسات من حروف المقاسات أو الأرقام بعد كلمة «مقاس»، والباقي وصف. لا يخترع شيئاً:
 * ما لم يُفهم يبقى في الوصف، والفريق يراجع كل شيء.
 */
export function parseProductLine(raw: string): ParsedLine {
  let text = toLatin(raw).replace(/[ \t]+/g, " ").replace(/\s*\n+\s*/g, "، ").trim();
  let price: number | null = null;

  // 1) السعر: علامة صريحة أو عملة.
  for (const re of PRICE_RES) {
    const m = re.exec(text);
    if (m && Number(m[1]) > 0) {
      price = Number(m[1]);
      text = `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`;
      break;
    }
  }

  // 2) المقاسات: بعد كلمة «مقاس/سايز» أو حروف مقاسات منفصلة.
  const options: Record<string, string[]> = {};
  const sizeAfterWord = /(?:مقاس(?:ات)?|سايز|sizes?)\s*:?\s*((?:(?:xxxl|4xl|3xl|2xl|xxl|xl|xs|s|m|l|free|\d{2}(?:\s*-\s*\d{2})?)(?![A-Za-z])[\s/،,-]*)+)/i;
  const sw = sizeAfterWord.exec(text);
  if (sw) {
    const toks = sw[1]!.split(/[\s/،,]+/).map((t) => t.trim()).filter(Boolean);
    if (toks.length) {
      options["المقاس"] = toks.map((t) => t.toUpperCase()).slice(0, 20);
      text = `${text.slice(0, sw.index)} ${text.slice(sw.index + sw[0].length)}`;
    }
  }
  if (!options["المقاس"]) {
    const letters = [...text.matchAll(SIZE_LETTER)].map((m) => m[1]!.toUpperCase());
    if (letters.length) {
      options["المقاس"] = [...new Set(letters)].slice(0, 20);
      text = text.replace(SIZE_LETTER, " ");
    }
  }

  // 3) رقم وحيد متبقٍ بلا علامة: سعر على الأرجح («جاكيت جلد 450»)، إلا إن بدا مقاس حذاء (رقمان متتاليان بين 30 و60).
  if (price === null) {
    const nums = [...text.matchAll(/(?<![\d.])(\d{1,7}(?:\.\d{1,2})?)(?![\d.])/g)].map((m) => ({ v: Number(m[1]), i: m.index ?? 0, len: m[0].length }));
    const looksSize = (n: { v: number }, k: number) => n.v >= 30 && n.v <= 60 && nums.some((o, j) => j !== k && o.v >= 30 && o.v <= 60);
    const cands = nums.filter((n, k) => n.v >= 10 && !looksSize(n, k));
    const last = cands[cands.length - 1];
    if (last) {
      price = last.v;
      text = `${text.slice(0, last.i)} ${text.slice(last.i + last.len)}`;
    }
  }

  // 4) الألوان: كل اسم لون معروف في النص (يقبل «و» لاصقة: وأبيض).
  const words = text.split(/[\s/،,;|]+/).filter(Boolean);
  const colors: string[] = [];
  for (const w of words) {
    const bare = w.replace(/^و(?=[^\s])/, "");
    const n = normalizeArabic(w);
    const nb = normalizeArabic(bare);
    const hit = COLOR_SET.has(n) ? w : COLOR_SET.has(nb) ? bare : null;
    if (hit && !colors.includes(hit)) colors.push(hit);
  }
  if (colors.length) options["اللون"] = colors.slice(0, 20);

  // 5) الاسم والوصف.
  const clauses = text.split(/[،,؛;|]|\s-\s/).map((c) => c.replace(/[/\\]/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const first = clauses.shift() ?? "";
  const cut = first.split(NAME_CUT)[0] ?? first;
  const colorRe = colors.length ? new RegExp(`(?:^|\\s)(?:و)?(?:${colors.map(escapeRe).join("|")})(?=\\s|$)`, "gi") : null;
  let name = cut.replace(/(?:^|\s)(?:اللون|لون|الوان|ألوان)(?=\s|$)/g, " ");
  if (colorRe) name = name.replace(colorRe, " ");
  name = name.replace(/\s+/g, " ").replace(/[:\-–]+$/, "").trim();
  // اسم بلا كلمات بعد التنظيف (تيشيرت كله ألوان…) أو أطول من اسم منتج: نرجع لبداية الكلام.
  if (name.length < 2) name = first.slice(0, 40).trim();
  name = name.split(" ").slice(0, 8).join(" ").slice(0, 80);

  const rest = [first.slice(cut.length), ...clauses]
    .map((c) => c.replace(colorRe ?? /$^/, " ").replace(/(?:^|\s)(?:اللون|لون|الوان|ألوان)\s*:?(?=\s|$)/g, " ").replace(/\s+/g, " ").replace(/^[\s:\-–]+|[\s:\-–]+$/g, ""))
    .filter((c) => c.length > 1);
  return { name, price: price && price > 0 ? price : null, ...(Object.keys(options).length ? { options } : {}), ...(rest.length ? { note: rest.join("، ").slice(0, 400) } : {}) };
}

export type DraftInput = { slug: string; code: string; data: IntakeData; imageUrl: (key: string | undefined) => string | null };

export type Draft = { blueprint: StoreBlueprint; seed: StoreSeed; missingPrice: string[]; questions: string[] };

export function buildDraft({ slug, data: d, imageUrl }: DraftInput): Draft {
  const name = d.store.name?.trim() || slug;
  const palette = d.colors.mode === "preset" ? paletteById(d.colors.preset) : null;
  const colorPreference = palette ? palette.colors.join(" ") : d.colors.mode === "custom" ? d.colors.custom : undefined;
  const social = d.social.url ?? "";
  const handle = /instagram\.com/i.test(social) ? handleFromSocial(social) : null;
  const products: SeedProduct[] = [];
  const missingPrice: string[] = [];

  for (const it of d.products.items) {
    const text = it.text?.trim();
    if (!text) continue;
    const p = parseProductLine(text);
    if (!p.name || p.name.length < 2) continue;
    if (p.price === null) {
      missingPrice.push(text);
      continue;
    }
    const imgs = it.images.map((k) => imageUrl(k)).filter((u): u is string => Boolean(u));
    products.push({ name: p.name, price: p.price, images: imgs, featured: products.length < 4, ...(p.options ? { options: p.options } : {}), ...(p.note ? { description: p.note } : {}) });
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
  // سياسات المتجر كما قالها التاجر في الاستمارة (الدفع برقم محفظته وإنستاباي، الشحن، المعاينة، الاستبدال). ما لم يُسأل عنه
  // (الضمان وسياسة العيوب) يبقى مطفأ في المسودة حتى يؤكده الفريق معه، فلا تظهر شارة أو سؤال شائع يعد بما لم يقله.
  bp.payments = paymentsFromIntake(d.payment, bp.payments);
  bp.shipping = shippingFromIntake(d.delivery, d.payment.methods.includes("cod") && d.payment.inspection === "yes", bp.shipping);
  bp.returns = returnsFromIntake(d.returns, bp.returns);

  // ما يلزم سؤاله للعميل بعد قراءة إجاباته (لا نسأل عما أجاب عنه).
  const questions: string[] = [];
  if (d.payment.methods.includes("wallet") && !d.payment.walletNumber) questions.push("رقم المحفظة (فودافون كاش) لم يُذكر.");
  if (d.payment.methods.includes("instapay") && !d.payment.instapayAddress) questions.push("بيانات إنستاباي لم تُذكر.");
  if (d.payment.methods.includes("cod") && !d.payment.inspection) questions.push("هل المعاينة وفتح الشحنة متاحان عند الاستلام؟");
  // أسعار المحافظات المفهومة من كلامه تُكتب في مناطق الشحن كما هي (zoneRows)، فلا يُسأل عنها.
  if (!feeNoteUnderstood(d.delivery)) questions.push(`أسعار الشحن لكل محافظة (قال العميل إنها تختلف${d.delivery.feeNote ? `: «${d.delivery.feeNote.replace(/\s+/g, " ").slice(0, 200)}»` : ""}).`);
  if (!d.delivery.fee) questions.push("سعر الشحن لم يُحدَّد (المسودة بالقيم الافتراضية).");
  if (!customScopeUnderstood(d.delivery)) questions.push(`المحافظات التي يوصّل لها: «${(d.delivery.note ?? "").slice(0, 200)}» (فُعِّلت كلها في المسودة، حدّدها بدقة).`);
  if (!d.returns.mode) questions.push("سياسة الاستبدال والاسترجاع (المدة ومن يتحمل الشحن): لم تُحدَّد.");
  else if (d.returns.mode !== "none") questions.push("من يتحمل مصاريف شحن المرتجع؟");
  return { blueprint: bp, seed: storeSeedSchema.parse({ categories: [], products }), missingPrice, questions };
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
    ...input.draft.questions.map((q) => `- ${q}`),
    "- ضمان العيوب وسياسة المنتج المعيب: مطفأة في المسودة حتى يؤكدها العميل.",
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
