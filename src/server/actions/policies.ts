"use server";
// تعديل سياسات المتجر من اللوحة: الاستبدال والاسترجاع، إلغاء العميل، المنتج المعيب، المعاينة، الشحن المجاني، الهدية والاستلام.
// بنمط الحفظ الجزئي (diff/patch): الصفحة ترسل ما تغيّر فقط، والخادم يسمح بمسارات هذه الصفحة وحده ويدمجه في النسخة الحالية
// (فلا يُكتب فوق ما حُفظ من صفحات أخرى)، ثم تتحدث صفحات السياسات وشارات الثقة فوراً.
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storeBlueprints } from "@/db/schema";
import { storeFor } from "@/server/merchant-guard";
import { blueprintSchema } from "@/blueprint/schema";
import { applyChanges, type BpChange } from "@/lib/blueprint-patch";
import { changesAllowed, policyIssue } from "@/lib/policy-changes";
import { saveBlueprintAction } from "./blueprint";

const input = z.array(z.object({ path: z.union([z.tuple([z.string().max(40)]), z.tuple([z.string().max(40), z.string().max(40)])]), value: z.unknown() })).min(1).max(40);

export async function savePoliciesAction(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await storeFor("settings");
  if (!s) return { ok: false, error: "غير مصرح" };
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "تغييرات غير صالحة" };
  const changes = parsed.data as BpChange[];
  if (!changesAllowed(changes)) return { ok: false, error: "تغييرات غير مسموحة في هذه الصفحة" };

  const [row] = await db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, s.storeId)).limit(1);
  const cur = row ? blueprintSchema.safeParse(row.data) : null;
  if (!cur?.success) return { ok: false, error: "تعذر قراءة إعدادات المتجر" };

  const next = blueprintSchema.safeParse(applyChanges(cur.data as unknown as Record<string, unknown>, changes));
  if (!next.success) return { ok: false, error: next.error.issues[0]?.message ?? "بيانات غير صالحة" };
  const issue = policyIssue({ returns: next.data.returns, shipping: next.data.shipping });
  if (issue) return { ok: false, error: issue };

  const r = await saveBlueprintAction(next.data, "تعديل السياسات والضمان");
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}
