"use server";
// size-guide.ts — حفظ جداول المقاسات من «دليل المقاسات» في اللوحة: يُدمج في الـ Blueprint الحالي (مع نسخة سابقة)،
// والأقسام المختارة تُقصر على أقسام المتجر نفسه.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, storeBlueprints } from "@/db/schema";
import { getTenantDb } from "@/db/tenant";
import { storeFor } from "@/server/merchant-guard";
import { blueprintSchema } from "@/blueprint/schema";
import { sizeGuideSchema } from "@/lib/size-guide";
import { saveBlueprintAction } from "./blueprint";

export async function saveSizeGuideAction(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await storeFor("products");
  if (!s) return { ok: false, error: "غير مصرح" };
  const parsed = sizeGuideSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: i?.path.includes("size") ? "كل صف يحتاج اسم مقاس (حتى 12 حرفاً)" : i?.path.includes("name") ? "كل جدول يحتاج اسماً" : "تحقق من القيم (أرقام الطول والوزن من 0 إلى 300)" };
  }
  const guide = parsed.data;
  for (const c of guide.charts) {
    const sizes = c.rows.map((r) => r.size.toLowerCase());
    if (new Set(sizes).size !== sizes.length) return { ok: false, error: `في «${c.name}» مقاس مكرر` };
    for (const r of c.rows) {
      if ((r.heightFrom != null) !== (r.heightTo != null) || (r.weightFrom != null) !== (r.weightTo != null)) return { ok: false, error: `في «${c.name}»: المدى يحتاج «من» و«إلى» معاً (المقاس ${r.size})` };
      if ((r.heightFrom ?? 0) > (r.heightTo ?? 300) || (r.weightFrom ?? 0) > (r.weightTo ?? 300)) return { ok: false, error: `في «${c.name}»: «من» أكبر من «إلى» (المقاس ${r.size})` };
    }
  }
  const ids = [...new Set(guide.charts.flatMap((c) => (Array.isArray(c.appliesTo) ? c.appliesTo : [])))];
  if (ids.length) {
    const tdb = await getTenantDb(s.storeId);
    const own = await tdb.select({ id: categories.id }).from(categories).where(and(eq(categories.storeId, s.storeId), inArray(categories.id, ids)));
    const ok = new Set(own.map((r) => r.id));
    for (const c of guide.charts) if (Array.isArray(c.appliesTo)) c.appliesTo = c.appliesTo.filter((id) => ok.has(id));
  }
  const [row] = await db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, s.storeId)).limit(1);
  const cur = row ? blueprintSchema.safeParse(row.data) : null;
  if (!cur?.success) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };
  const r = await saveBlueprintAction({ ...cur.data, sizeGuide: guide }, "تعديل دليل المقاسات");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
