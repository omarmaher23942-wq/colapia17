"use server";

// growth.ts — هدف المبيعات الشهري والإنفاق الإعلاني الشهري (يُحفظان في stores.prefs). مجال الإعدادات بمستوى الإدارة.
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { storeFor } from "@/server/merchant-guard";
import { monthKey, withAdSpend, withGoal } from "@/lib/sales-goal";

type R = { ok: true } | { ok: false; error: string };

async function prefsOf(storeId: string): Promise<Record<string, unknown>> {
  const [r] = await db.select({ prefs: stores.prefs }).from(stores).where(eq(stores.id, storeId)).limit(1);
  return (r?.prefs ?? {}) as Record<string, unknown>;
}

const amount = z.number().finite().int().min(0).max(1_000_000_000);

export async function saveSalesGoalAction(goalEgp: number | null): Promise<R> {
  const s = await storeFor("settings");
  if (!s) return { ok: false, error: "انتهت جلستكم، سجّلوا الدخول من جديد" };
  const v = goalEgp === null ? { success: true as const, data: null } : amount.safeParse(Math.round(goalEgp));
  if (!v.success) return { ok: false, error: "أدخلوا هدفاً صحيحاً بالجنيه" };
  const next = withGoal(await prefsOf(s.storeId), v.data && v.data > 0 ? v.data : null);
  await db.update(stores).set({ prefs: next }).where(eq(stores.id, s.storeId));
  revalidatePath("/dashboard");
  return { ok: true };
}

/** يخفي بطاقة «مشاركة المتجر» بعد أن يؤكد التاجر أنه نشر رابطه. */
export async function markShareDoneAction(): Promise<R> {
  const s = await storeFor("settings");
  if (!s) return { ok: false, error: "انتهت جلستكم، سجّلوا الدخول من جديد" };
  await db.update(stores).set({ prefs: { ...(await prefsOf(s.storeId)), shareDone: true } }).where(eq(stores.id, s.storeId));
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function saveAdSpendAction(spendEgp: number): Promise<R> {
  const s = await storeFor("settings");
  if (!s) return { ok: false, error: "انتهت جلستكم، سجّلوا الدخول من جديد" };
  const v = amount.safeParse(Math.round(spendEgp));
  if (!v.success) return { ok: false, error: "أدخلوا مبلغاً صحيحاً بالجنيه" };
  const next = withAdSpend(await prefsOf(s.storeId), monthKey(new Date()), v.data);
  await db.update(stores).set({ prefs: next }).where(eq(stores.id, s.storeId));
  revalidatePath("/dashboard");
  return { ok: true };
}
