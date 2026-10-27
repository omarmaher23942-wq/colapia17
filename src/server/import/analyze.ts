import "server-only";
// analyze.ts — فرز مدخلات التاجر إلى «مرشّحين» للمراجعة. كل استدعاء ذكي: حد شهري (checkAiQuota/recordAi)،
// مخطط Zod صارم، وسقوط صادق إلى الفرز الأساسي حين يتعذر (فلا يضيع عمل التاجر). لا يُحفظ شيء هنا: الحفظ بعد المراجعة.
import { aiObject } from "@/ai/providers";
import {
  aiProductsSchema,
  candidateFromAi,
  candidatesFromTable,
  IMPORT_MAX_CANDIDATES,
  mergeCandidates,
  normalizeCandidate,
  parseProductEntry,
  unifyCategories,
  type Candidate,
} from "@/lib/import-candidates";
import { checkAiQuota, recordAi } from "@/server/ai-guard";
import { candidatesFromPlatform, PLATFORM_LABEL } from "@/lib/platform-import";
import { fetchRemoteImage } from "@/server/remote-image";

export type AnalyzeResult = { ok: true; candidates: Candidate[]; usedAi: boolean; notice?: string } | { ok: false; error: string };

const SYSTEM = `أنت تفرز كلام تاجر مصري إلى قائمة منتجات متجر إلكتروني.
قواعد صارمة:
- أخرج منتجاً لكل صنف مختلف فقط. لا تخترع منتجات ولا أسعاراً ولا مقاسات ولا ألواناً غير مذكورة أو ظاهرة بوضوح.
- السعر بالجنيه المصري. إن لم يُذكر سعر اجعله null. السعر قبل الخصم فقط إن ذُكر صراحة أنه «بدل» أو «قبل الخصم».
- المقاسات والألوان تُملأ فقط إن ذُكرت. المقاسات حروف (S M L XL XXL) أو أرقام (38 40)، و«مقاس واحد» للمقاس الحر.
- الاسم قصير وواضح كما يظهر للمشتري (بلا أسعار ولا إيموجي). الوصف جملة أو جملتان صادقتان من الكلام نفسه أو فارغ.
- القسم كلمة أو كلمتان بالعربية (مثل: تيشيرتات، أحذية، حقائب، إكسسوارات)، ووحّد الأسماء المتشابهة.
- اجعل لغة الأسماء كما كتبها التاجر.`;

const IMAGE_SYSTEM = `أنت تفرز صوراً أرسلها تاجر مصري لمتجره إلى منتجات.
قواعد صارمة:
- الصور مرقمة بدءاً من 0. أخرج لكل منتج مختلف عنصراً واحداً مع أرقام صوره في imageIndexes. كل صورة تنتمي لمنتج واحد على الأكثر.
- الاسم وصف عربي قصير وصادق لما يظهر (مثل: تيشيرت قطن أبيض، حذاء رياضي أسود). لا تخترع علامة تجارية.
- لا تذكر سعراً إلا إن كان مكتوباً داخل الصورة بوضوح، وإلا null.
- الألوان فقط ما يظهر بوضوح. المقاسات فقط إن كانت مكتوبة. الوصف جملة صادقة مما يُرى أو فارغ.
- القسم كلمة أو كلمتان بالعربية.`;

async function guardQuota(storeId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const q = await checkAiQuota(storeId, "import");
  return q.ok ? { ok: true } : { ok: false, message: q.message };
}

/** نص حر ← مرشّحون. الفرز الأساسي (بلا ذكاء) جاهز دائماً كاحتياط ولإكمال ما فات. */
export async function analyzeText(storeId: string, entries: string[], source: Candidate["source"] = "text"): Promise<AnalyzeResult> {
  const cleaned = entries.map((e) => e.trim()).filter(Boolean).slice(0, 40);
  if (!cleaned.length) return { ok: false, error: "لم نجد نصاً لفرزه" };
  const basic = cleaned.map(parseProductEntry).filter((c): c is Candidate => Boolean(c)).map((c) => ({ ...c, source }));

  const q = await guardQuota(storeId);
  if (!q.ok) return { ok: true, candidates: basic, usedAi: false, notice: `${q.message} فرزنا النص بالطريقة الأساسية، فراجعوا الأسماء والأسعار.` };
  try {
    const out = await aiObject(
      "fast",
      {
        schema: aiProductsSchema,
        schemaName: "products",
        system: SYSTEM,
        prompt: `المدخلات (كل رقم قد يكون منتجاً أو أكثر):\n${cleaned.map((e, i) => `${i + 1}. ${e}`).join("\n")}`,
        temperature: 0.1,
        maxTokens: 4_000,
        budgetMs: 24_000,
        timeoutMs: 14_000,
      },
      { purpose: "setup_import_text", storeId }
    );
    await recordAi(storeId, "import");
    const ai = out.products.map((p) => candidateFromAi(p, [], source)).filter((c): c is Candidate => Boolean(c));
    // إن أهمل النموذج أسطراً كثيرة نكمل بالأساسي (الاسم المكرر يُدمج ولا يتكرر).
    const merged = ai.length >= basic.length * 0.8 ? ai : mergeCandidates(ai, basic);
    return { ok: true, candidates: unifyCategories(merged), usedAi: true };
  } catch (e) {
    console.error("[import.analyzeText]", e);
    return { ok: true, candidates: basic, usedAi: false, notice: "تعذر الفرز التلقائي الآن، فرزنا النص بالطريقة الأساسية. راجعوا الأسماء والأسعار قبل الاعتماد." };
  }
}

/** صور مرفوعة (روابطها على مساحة المتجر) ← مرشّحون. mode: صورة لكل منتج، أو صور مجمّعة قد تخص منتجاً واحداً. */
export async function analyzeImages(storeId: string, urls: string[], mode: "per_image" | "grouped"): Promise<AnalyzeResult> {
  const list = urls.filter((u) => /^https:\/\//.test(u)).slice(0, 6);
  if (!list.length) return { ok: false, error: "لا توجد صور صالحة" };
  const fallback = (notice: string): AnalyzeResult => ({
    ok: true,
    usedAi: false,
    notice,
    candidates: list.map((u, i) => ({ ...(normalizeCandidate({ name: `منتج ${i + 1}`, images: [u], source: "image" }) as Candidate) })),
  });

  const q = await guardQuota(storeId);
  if (!q.ok) return fallback(`${q.message} أضفنا كل صورة كمنتج مستقل، فاكتبوا الأسماء والأسعار.`);

  const bytes: { bytes: Uint8Array; type: string; url: string }[] = [];
  for (const url of list) {
    const got = await fetchRemoteImage(url);
    if (got.ok) bytes.push({ bytes: got.image.bytes, type: got.image.type, url });
  }
  if (!bytes.length) return fallback("تعذرت قراءة الصور الآن. أضفنا كل صورة كمنتج مستقل، فاكتبوا الأسماء والأسعار.");

  try {
    const out = await aiObject(
      "vision",
      {
        schema: aiProductsSchema,
        schemaName: "products",
        system: IMAGE_SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: mode === "per_image" ? "كل صورة منتج مستقل." : "قد تكون عدة صور لمنتج واحد (زوايا أو ألوان)، فاجمعها." },
              ...bytes.flatMap((b, i) => [
                { type: "text" as const, text: `الصورة ${i}:` },
                { type: "image" as const, image: b.bytes, mediaType: b.type },
              ]),
            ],
          },
        ],
        temperature: 0.1,
        maxTokens: 2_500,
        budgetMs: 24_000,
        timeoutMs: 16_000,
      },
      { purpose: "setup_import_images", storeId }
    );
    await recordAi(storeId, "import");
    const urlsOk = bytes.map((b) => b.url);
    let cands = out.products.map((p) => candidateFromAi(p, urlsOk, "image")).filter((c): c is Candidate => Boolean(c));
    // صورة لم يضمّها النموذج لأي منتج لا تضيع: تصير منتجاً مستقلاً.
    const used = new Set(cands.flatMap((c) => c.images));
    const left = urlsOk.filter((u) => !used.has(u));
    cands = [...cands, ...left.map((u, i) => normalizeCandidate({ name: `منتج ${cands.length + i + 1}`, images: [u], source: "image" })).filter((c): c is Candidate => Boolean(c))];
    return { ok: true, candidates: unifyCategories(cands), usedAi: true };
  } catch (e) {
    console.error("[import.analyzeImages]", e);
    return fallback("تعذر التعرف على الصور الآن. أضفنا كل صورة كمنتج مستقل، فاكتبوا الأسماء والأسعار.");
  }
}

/** ملف PDF ← مرشّحون (يُقرأ بصرياً: يعمل مع النصي والممسوح). */
export async function analyzePdf(storeId: string, bytes: Uint8Array): Promise<AnalyzeResult> {
  const q = await guardQuota(storeId);
  if (!q.ok) return { ok: false, error: q.message };
  try {
    const out = await aiObject(
      "vision",
      {
        schema: aiProductsSchema,
        schemaName: "products",
        system: SYSTEM + "\nالمدخل ملف PDF لقائمة أسعار أو كتالوج: استخرج المنتجات المكتوبة فيه فقط.",
        messages: [{ role: "user", content: [{ type: "text", text: "استخرج منتجات هذا الملف." }, { type: "file", data: bytes, mediaType: "application/pdf" }] }],
        temperature: 0.1,
        maxTokens: 4_000,
        budgetMs: 26_000,
        timeoutMs: 20_000,
      },
      { purpose: "setup_import_pdf", storeId }
    );
    await recordAi(storeId, "import");
    const cands = out.products.map((p) => candidateFromAi(p, [], "file")).filter((c): c is Candidate => Boolean(c));
    if (!cands.length) return { ok: false, error: "لم نجد منتجات داخل الملف. جرّبوا صوراً للصفحات أو اكتبوا القائمة نصاً." };
    return { ok: true, candidates: unifyCategories(cands), usedAi: true };
  } catch (e) {
    console.error("[import.analyzePdf]", e);
    return { ok: false, error: "تعذرت قراءة ملف PDF الآن. ارفعوا صور صفحاته أو انسخوا القائمة كنص." };
  }
}

/** جدول (xlsx/csv) ← مرشّحون بلا استدعاء ذكي: العناوين العربية والإنجليزية تُقرأ مباشرة. */
export function analyzeTable(table: string[][]): AnalyzeResult {
  // ملف تصدير من منصة معروفة (Shopify، WooCommerce، سلة، زد): قراءة بأعمدتها الأصلية.
  const plat = candidatesFromPlatform(table);
  if (plat && plat.candidates.length) {
    const cut = plat.candidates.length > IMPORT_MAX_CANDIDATES;
    return { ok: true, candidates: unifyCategories(plat.candidates.slice(0, IMPORT_MAX_CANDIDATES)), usedAi: false, notice: `تعرّفنا على ملف تصدير ${PLATFORM_LABEL[plat.platform]}.${cut ? ` قرأنا أول ${IMPORT_MAX_CANDIDATES} منتج فقط، فارفعوا الباقي في دفعة ثانية.` : ""}` };
  }
  const { candidates, truncated } = candidatesFromTable(table);
  if (!candidates.length) return { ok: false, error: "لم نجد منتجات في الجدول. تأكدوا أن الصف الأول عناوين مثل: اسم المنتج، السعر." };
  return { ok: true, candidates: unifyCategories(candidates), usedAi: false, notice: truncated ? "قرأنا أول 200 منتج فقط. ارفعوا الباقي في دفعة ثانية." : undefined };
}
