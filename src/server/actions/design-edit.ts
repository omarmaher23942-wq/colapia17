"use server";

// design-edit.ts — إجراءات «اكتبوا ما تريدون تغييره»: اقتراح بمعاينة «قبل/بعد»، ثم تطبيق، وتراجع، وسجل آخر التعديلات.
// كلها تحت صلاحية «المحتوى» (إدارة للتعديل، وعرض للسجل).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { storeFor } from "@/server/merchant-guard";
import { designOpSchema } from "@/lib/design-tweak";
import { applyDesignEdit, editHistory, proposeDesignEdit, undoToVersion, type ApplyOutcome, type DesignHistoryItem, type ProposeOutcome } from "@/server/design-tweak";

const SESSION_ERR = "انتهت جلستكم، سجّلوا الدخول من جديد";

export async function proposeDesignEditAction(raw: unknown): Promise<ProposeOutcome> {
  const s = await storeFor("content");
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = z.object({ text: z.string().max(600) }).safeParse(raw);
  if (!p.success) return { ok: false, error: "الوصف طويل. اختصروه في 600 حرف على الأكثر." };
  return proposeDesignEdit(s.storeId, p.data.text);
}

export async function applyDesignEditAction(raw: unknown): Promise<ApplyOutcome> {
  const s = await storeFor("content");
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = z.object({ text: z.string().max(600), ops: z.array(designOpSchema).min(1).max(30) }).safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات التعديل غير صالحة" };
  const r = await applyDesignEdit(s.storeId, p.data.ops, p.data.text);
  if (r.ok) revalidatePath("/dashboard/design");
  return r;
}

export async function undoDesignEditAction(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await storeFor("content");
  if (!s) return { ok: false, error: SESSION_ERR };
  const p = z.object({ version: z.number().int().min(1) }).safeParse(raw);
  if (!p.success) return { ok: false, error: "نسخة غير صالحة" };
  const r = await undoToVersion(s.storeId, p.data.version);
  if (r.ok) revalidatePath("/dashboard/design");
  return r;
}

export async function designEditHistoryAction(): Promise<DesignHistoryItem[]> {
  const s = await storeFor("content", "view");
  if (!s) return [];
  return editHistory(s.storeId);
}
