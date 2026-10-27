import "server-only";
// vision-read.ts — قراءة صورة منتج واحدة (الرفع المجمّع): الاسم واللون والقسم وسمات النشاط ووصف قصير صادق.
// صورة = استدعاء واحد محسوب على حد «قراءة الصور» الشهري (checkAiQuota/recordAi بنوع image). السعر لا يُقرأ أبداً:
// يكتبه التاجر بنفسه. تعذر القراءة لا يُفشل شيئاً: يعود المنتج فارغاً ليكمله التاجر، مع سبب صادق.
import { z } from "zod";
import { aiObject } from "@/ai/providers";
import { attributesFor, cleanAttributes, NICHE_LABEL, type AttrPair, type Niche } from "@/lib/niche-attributes";
import { normalizeColor } from "@/lib/import-candidates";
import { checkAiQuota, recordAi } from "@/server/ai-guard";
import { fetchRemoteImage } from "@/server/remote-image";

export type PhotoRead = { name: string; color: string; category: string; description: string; attributes: AttrPair[] };
export type PhotoReadResult = { ok: true; read: PhotoRead; usedAi: boolean; notice?: string } | { ok: false; error: string };

const readSchema = z.object({
  name: z.string().describe("اسم قصير وصادق لما يظهر في الصورة كما يراه المشتري، بلا علامة تجارية غير مكتوبة"),
  color: z.string().optional().describe("اللون الأساسي الظاهر بوضوح بالعربية، أو فارغ"),
  category: z.string().optional().describe("قسم من كلمة أو كلمتين بالعربية"),
  description: z.string().optional().describe("جملة أو جملتان صادقتان مما يُرى فقط"),
  attributes: z.array(z.object({ label: z.string(), value: z.string() })).optional().describe("سمات ظاهرة أو مكتوبة بوضوح فقط"),
});

const EMPTY: PhotoRead = { name: "", color: "", category: "", description: "", attributes: [] };

function systemFor(niche: Niche, existingCategories: string[]): string {
  const attrs = attributesFor(niche);
  const attrLine = attrs.length
    ? `السمات المسموحة (اكتب اسم السمة كما هو تماماً، واملأ فقط ما يظهر أو يُكتب بوضوح في الصورة):\n${attrs.map((a) => `- ${a.label}${a.values ? ` (أمثلة: ${a.values.slice(0, 4).join("، ")})` : ""}`).join("\n")}`
    : "لا تُخرج سمات إلا ما هو مكتوب بوضوح على المنتج.";
  return `أنت تقرأ صورة منتج واحد لمتجر إلكتروني مصري نشاطه: ${NICHE_LABEL[niche]}.
قواعد صارمة:
- صف ما تراه فقط. لا تخترع علامة تجارية أو خامة أو مواصفة غير ظاهرة أو غير مكتوبة.
- لا تذكر أي سعر.
- الاسم من 2 إلى 6 كلمات بالعربية (مثل: تيشيرت قطن أبيض، سماعة لاسلكية سوداء).
- اللون الأساسي فقط إن كان واضحاً.
- القسم اقتراح أولي من كلمة أو كلمتين بصيغة عامة تشمل منتجات كثيرة (مثل: ملابس، أحذية، إكسسوارات) وليس اسم هذا المنتج، ويُجمع لاحقاً مع بقية المنتجات${existingCategories.length ? `. استعمل أحد الأقسام الحالية إن ناسب: ${existingCategories.slice(0, 12).join("، ")}` : ""}.
${attrLine}`;
}

/** يقرأ صورة واحدة على مساحة ملفات المتجر. لا يرمي: الفشل يعيد حقولاً فارغة مع ملاحظة. */
export async function readProductPhoto(storeId: string, url: string, niche: Niche, existingCategories: string[] = []): Promise<PhotoReadResult> {
  const q = await checkAiQuota(storeId, "image");
  if (!q.ok) return { ok: true, read: EMPTY, usedAi: false, notice: `${q.message} اكتبوا اسم المنتج وبياناته بأنفسكم.` };

  const got = await fetchRemoteImage(url);
  if (!got.ok) return { ok: true, read: EMPTY, usedAi: false, notice: "تعذرت قراءة الصورة الآن. اكتبوا اسم المنتج وبياناته بأنفسكم." };

  try {
    const out = await aiObject(
      "vision",
      {
        schema: readSchema,
        schemaName: "product_photo",
        system: systemFor(niche, existingCategories),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "اقرأ هذا المنتج." },
              { type: "image", image: got.image.bytes, mediaType: got.image.type },
            ],
          },
        ],
        temperature: 0.1,
        maxTokens: 700,
        budgetMs: 20_000,
        timeoutMs: 14_000,
      },
      { purpose: "setup_photo_read", storeId }
    );
    await recordAi(storeId, "image");
    const allowed = new Set(attributesFor(niche).map((a) => a.label));
    const attributes = cleanAttributes((out.attributes ?? []).filter((a) => allowed.has(a.label.trim())).map((a) => ({ label: a.label.trim(), value: a.value })));
    return {
      ok: true,
      usedAi: true,
      read: {
        name: (out.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
        color: normalizeColor(out.color ?? "") ?? "",
        category: (out.category ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
        description: (out.description ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
        attributes,
      },
    };
  } catch (e) {
    console.error("[import.readProductPhoto]", e);
    return { ok: true, read: EMPTY, usedAi: false, notice: "تعذر التعرف على بعض الصور الآن. أكملوا بياناتها بأنفسكم." };
  }
}
