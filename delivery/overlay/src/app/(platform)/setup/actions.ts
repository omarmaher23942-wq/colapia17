"use server";
// actions.ts — خطوات صفحة /setup: تجهيز قاعدة البيانات، ثم إنشاء حساب صاحب المتجر (مرة واحدة).
// الصفحة عامة قبل اكتمال الإعداد فقط؛ بعد وجود المالك ترفض الإجراءات كلها.
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { runMigrations } from "@/server/setup/migrate";
import { setupStatus } from "@/server/setup/status";
import { createOwnerAndStore, setupCodeOk } from "@/server/setup/owner";
import { allow, clientIp } from "@/lib/ratelimit";

export type MigrateResult = { ok: true; applied: number } | { ok: false; error: string };
export type CreateState = { error: string | null; recoveryCode?: string };

async function guard(): Promise<string | null> {
  if (!(await allow("setup", clientIp(await headers())))) return "محاولات كثيرة. انتظروا دقائق ثم أعيدوا المحاولة.";
  const st = await setupStatus();
  if (st.ownerExists) return "تم الإعداد من قبل. ادخلوا من صفحة الدخول.";
  return null;
}

export async function migrateAction(): Promise<MigrateResult> {
  const blocked = await guard();
  if (blocked) return { ok: false, error: blocked };
  try {
    const r = await runMigrations();
    revalidatePath("/setup");
    return { ok: true, applied: r.applied };
  } catch (e) {
    console.error("[setup] migrate failed", e);
    return { ok: false, error: "تعذّر تجهيز قاعدة البيانات. تأكدوا من رابط القاعدة (DATABASE_URL) ثم أعيدوا المحاولة." };
  }
}

export async function createOwnerAction(_prev: CreateState, form: FormData): Promise<CreateState> {
  const blocked = await guard();
  if (blocked) return { error: blocked };
  if (!setupCodeOk(String(form.get("setupCode") ?? ""))) return { error: "رمز الإعداد غير صحيح." };
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) return { error: "كلمتا المرور غير متطابقتين." };
  const r = await createOwnerAndStore({ password });
  if (!r.ok) return { error: r.error };
  revalidatePath("/setup");
  return { error: null, recoveryCode: r.recoveryCode };
}
