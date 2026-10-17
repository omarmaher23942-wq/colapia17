"use server";

// questions.ts — إدارة أسئلة المنتجات: الإجابة (تظهر في صفحة المنتج)، والإخفاء، وإعادة الفتح، والحذف. مجال المنتجات بمستوى الإدارة.
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { productQuestions } from "@/db/schema";
import { storeFor } from "@/server/merchant-guard";

type R = { ok: true } | { ok: false; error: string };
const id = z.string().uuid();

async function ctx() {
  const s = await storeFor("products");
  return s ? { ...s, db: await getTenantDb(s.storeId) } : null;
}

export async function answerQuestionAction(questionId: string, answer: string): Promise<R> {
  const s = await ctx();
  if (!s) return { ok: false, error: "انتهت جلستكم، سجّلوا الدخول من جديد" };
  const a = z.string().trim().min(2, "اكتبوا الإجابة").max(1000, "الإجابة طويلة (حتى 1000 حرف)").safeParse(answer);
  if (!id.safeParse(questionId).success) return { ok: false, error: "بيانات غير صالحة" };
  if (!a.success) return { ok: false, error: a.error.issues[0]!.message };
  const rows = await s.db
    .update(productQuestions)
    .set({ answer: a.data, status: "answered", answeredAt: new Date() })
    .where(and(eq(productQuestions.id, questionId), eq(productQuestions.storeId, s.storeId)))
    .returning({ productId: productQuestions.productId });
  if (!rows.length) return { ok: false, error: "السؤال غير موجود" };
  revalidatePath("/dashboard/questions");
  return { ok: true };
}

export async function setQuestionStateAction(questionId: string, state: "hidden" | "pending" | "delete"): Promise<R> {
  const s = await ctx();
  if (!s) return { ok: false, error: "انتهت جلستكم، سجّلوا الدخول من جديد" };
  if (!id.safeParse(questionId).success || !["hidden", "pending", "delete"].includes(state)) return { ok: false, error: "بيانات غير صالحة" };
  const where = and(eq(productQuestions.id, questionId), eq(productQuestions.storeId, s.storeId));
  if (state === "delete") await s.db.delete(productQuestions).where(where);
  else await s.db.update(productQuestions).set(state === "pending" ? { status: "pending", answer: null, answeredAt: null } : { status: "hidden" }).where(where);
  revalidatePath("/dashboard/questions");
  return { ok: true };
}
