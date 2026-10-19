import "server-only";
// categorize.ts — تصنيف مجمّع واحد لكل المنتجات التي قُرئت في دفعة رفع: استدعاء نصي واحد رخيص (أسماء المنتجات فقط، بلا صور)
// يقرر مجموعة صغيرة من الأقسام (حتى 6 بعد دمج المترادفات) ثم يوزّع كل منتج على أحدها. يعلو عليه دائماً التوحيد الحتمي
// (category-merge): فلا يخرج منه قسم لكل منتج حتى لو أخطأ النموذج أو تعذّر. تعذر الذكاء لا يُفشل شيئاً.
import { z } from "zod";
import { aiObject } from "@/ai/providers";
import { mergeAiAssignment, MAX_CATEGORIES, planCategories, type CategoryItem } from "@/lib/category-merge";
import { NICHE_LABEL, type Niche } from "@/lib/niche-attributes";
import { checkAiQuota, recordAi } from "@/server/usage";

export type CategorizeInput = { id: string; name: string; category: string };
export type CategorizeResult = { assign: Record<string, string>; categories: string[]; usedAi: boolean };

const outSchema = z.object({
  categories: z.array(z.string()).max(12).describe("أسماء الأقسام المختارة (كلمة أو كلمتان)، 6 أو أقل"),
  items: z.array(z.object({ i: z.number(), c: z.number() })).max(300).describe("لكل منتج: رقمه i ورقم قسمه c في categories"),
});

const SYSTEM = `أنت تنظّم منتجات متجر إلكتروني مصري في أقسام قليلة وواضحة.
قواعد صارمة:
- اختر عدداً قليلاً من الأقسام: 6 كحد أقصى، وأقل ما يكفي. لا تجعل لكل منتج قسماً.
- ادمج المترادفات والمفرد والجمع في قسم واحد (مثل: تيشيرت وتيشيرتات).
- اسم القسم كلمة أو كلمتان بالعربية، عام وليس اسم منتج بعينه.
- إن وُجدت أقسام قائمة في المتجر فاستعملها كما هي متى ناسبت المنتج.
- كل منتج ينتمي لقسم واحد بالضبط، ولا تخترع منتجات.`;

export async function categorizeBatch(storeId: string, items: CategorizeInput[], niche: Niche, existing: string[]): Promise<CategorizeResult> {
  const list = items.slice(0, 300);
  const base: CategoryItem[] = list.map((x) => ({ id: x.id, category: x.category }));
  const finish = (cands: CategoryItem[], usedAi: boolean): CategorizeResult => {
    const plan = planCategories(cands, existing, MAX_CATEGORIES);
    return { assign: plan.assign, categories: plan.categories, usedAi };
  };
  if (list.length < 2) return finish(base, false);

  const q = await checkAiQuota(storeId, "import");
  if (!q.ok) return finish(base, false);
  try {
    const out = await aiObject(
      "fast",
      {
        schema: outSchema,
        schemaName: "categories",
        system: SYSTEM,
        prompt: `نشاط المتجر: ${NICHE_LABEL[niche]}.\nأقسام المتجر الحالية: ${existing.length ? existing.slice(0, 20).join("، ") : "لا يوجد"}.\nالمنتجات:\n${list.map((x, i) => `${i}. ${x.name || "بلا اسم"}${x.category ? ` (مقترح: ${x.category})` : ""}`).join("\n")}`,
        temperature: 0.1,
        maxTokens: 2_500,
        budgetMs: 20_000,
        timeoutMs: 12_000,
      },
      { purpose: "setup_categorize", storeId }
    );
    await recordAi(storeId, "import");
    return finish(mergeAiAssignment(base, { categories: out.categories, assign: out.items }), true);
  } catch (e) {
    console.error("[import.categorizeBatch]", e);
    return finish(base, false);
  }
}
