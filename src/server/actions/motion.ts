"use server";
// حركة المتجر وعمقه ثلاثي الأبعاد من «تصميم المتجر»: يتغير الإحساس دون المساس بالتصميم أو المحتوى.
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { storeBlueprints } from "@/db/schema";
import { getMerchantStoreOrNull } from "@/server/auth";
import { blueprintSchema } from "@/blueprint/schema";
import { saveBlueprintAction } from "./blueprint";

const input = z.object({ level: z.enum(["calm", "lively", "cinematic"]), depth: z.boolean() });

export async function saveMotionAction(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await getMerchantStoreOrNull();
  if (!s) return { ok: false, error: "غير مصرح" };
  const p = input.safeParse(raw);
  if (!p.success) return { ok: false, error: "اختيار غير صالح" };
  const [row] = await db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, s.storeId)).limit(1);
  const cur = row ? blueprintSchema.safeParse(row.data) : null;
  if (!cur?.success) return { ok: false, error: "تعذر قراءة تصميم المتجر" };
  const r = await saveBlueprintAction({ ...cur.data, design: { ...cur.data.design, motion: p.data } }, "تعديل حركة المتجر");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
