// repair.ts — إصلاح حتمي لـ Blueprint ناتج عن الذكاء الاصطناعي قبل حفظه.
//
// المبدأ: نحتفظ بكل جزء صالح من مخرجات الـ AI، ونستبدل كل جزء غير صالح بنظيره من
// الـ Blueprint الافتراضي. النتيجة صالحة دائماً للمخطط، فلا يصل متجر مبني إلى 404.
import { blueprintSchema, policyPageSchema, sectionSchema, type StoreBlueprint } from "./schema";
import { defaultBlueprint } from "./defaults";

export type RepairReport = { repaired: boolean; droppedSections: number; droppedPages: number; replacedKeys: string[] };

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export function repairBlueprint(
  input: unknown,
  fallback: { name: string; storeId?: string }
): { blueprint: StoreBlueprint; report: RepairReport } {
  const direct = blueprintSchema.safeParse(input);
  if (direct.success) {
    return { blueprint: direct.data, report: { repaired: false, droppedSections: 0, droppedPages: 0, replacedKeys: [] } };
  }

  const raw = asRecord(input);
  const base = defaultBlueprint({ name: fallback.name, storeId: fallback.storeId });

  const rawHome = Array.isArray(raw.home) ? raw.home : [];
  const home = rawHome
    .map((s) => sectionSchema.safeParse(s))
    .filter((r) => r.success)
    .map((r) => r.data!)
    .slice(0, 24);

  const rawPages = Array.isArray(raw.pages) ? raw.pages : [];
  const pages = rawPages
    .map((p) => policyPageSchema.safeParse(p))
    .filter((r) => r.success)
    .map((r) => r.data!);

  const candidate: Record<string, unknown> = {
    ...raw,
    home: home.length ? home : base.home,
    pages: pages.length ? pages : base.pages,
  };

  // أي مفتاح علوي ما زال غير صالح يُستبدل بالافتراضي.
  const replacedKeys: string[] = [];
  const shape = blueprintSchema.shape as Record<string, { safeParse: (v: unknown) => { success: boolean } }>;
  for (const key of Object.keys(shape)) {
    if (!shape[key]!.safeParse(candidate[key]).success) {
      candidate[key] = (base as unknown as Record<string, unknown>)[key];
      replacedKeys.push(key);
    }
  }

  return {
    blueprint: blueprintSchema.parse(candidate),
    report: {
      repaired: true,
      droppedSections: rawHome.length - home.length,
      droppedPages: rawPages.length - pages.length,
      replacedKeys,
    },
  };
}
