"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storeDbTransfers } from "@/db/schema";
import { ownerStore } from "@/server/merchant-guard";
import { platformUser } from "@/server/platform-guard";
import { provisionStoreDatabase } from "@/server/transfer/neon-api";
import { advanceTransfer, retryTransfer, startRollback, startTransfer, type StepResult } from "@/server/transfer";

type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const DENIED = { ok: false as const, error: "نقل البيانات متاح لصاحب المتجر وحده." };

/** يبدأ النقل بالرابط الملصوق ويشغّل أول جزء منه. صاحب المتجر وحده. */
export async function startTransferAction(databaseUrl: string): Promise<Res<{ jobId: string; step: StepResult }>> {
  const s = await ownerStore();
  if (!s) return DENIED;
  const r = await startTransfer(s.store.id, String(databaseUrl ?? ""));
  if (!r.ok) return r;
  return { ok: true, jobId: r.jobId, step: await advanceTransfer(r.jobId) };
}

async function ownJob(jobId: string): Promise<boolean> {
  const s = await ownerStore();
  if (!s) return false;
  const [j] = await db
    .select({ id: storeDbTransfers.id })
    .from(storeDbTransfers)
    .where(and(eq(storeDbTransfers.id, String(jobId)), eq(storeDbTransfers.storeId, s.store.id)))
    .limit(1);
  return !!j;
}

/** يتابع العمل (يستدعيه المتصفح بالتتابع حتى يكتمل). */
export async function stepTransferAction(jobId: string): Promise<Res<{ step: StepResult }>> {
  if (!(await ownJob(jobId))) return DENIED;
  return { ok: true, step: await advanceTransfer(jobId) };
}

export async function retryTransferAction(jobId: string): Promise<Res<{ step: StepResult }>> {
  if (!(await ownJob(jobId))) return DENIED;
  return { ok: true, step: await retryTransfer(jobId) };
}

/** «الرجوع لقاعدة المنصة»: مدير المنصة وحده، خلال مهلة نسخة المنصة. يشغّل أول جزء؛ الباقي يُستأنف من لوحة الوكالة. */
export async function rollbackTransferAction(storeId: string): Promise<Res<{ jobId: string; step: StepResult }>> {
  const admin = await platformUser({ write: true });
  if (!admin) return { ok: false, error: "الرجوع لمدير المنصة وحده." };
  const r = await startRollback(String(storeId));
  if (!r.ok) return r;
  return { ok: true, jobId: r.jobId, step: await advanceTransfer(r.jobId) };
}

/** قاعدة مستقلة لمتجر بعينه عبر Neon API (مدير المنصة، والعلم مطفأ افتراضياً). */
export async function provisionStoreDbAction(storeId: string): Promise<Res<{ jobId: string; step: StepResult }>> {
  const admin = await platformUser({ write: true });
  if (!admin) return { ok: false, error: "لمدير المنصة وحده." };
  const r = await provisionStoreDatabase(String(storeId));
  if (!r.ok) return r;
  return { ok: true, jobId: r.jobId, step: await advanceTransfer(r.jobId) };
}

/** متابعة مهمة رجوع من لوحة الوكالة. */
export async function stepRollbackAction(jobId: string): Promise<Res<{ step: StepResult }>> {
  const admin = await platformUser({ write: true });
  if (!admin) return { ok: false, error: "الرجوع لمدير المنصة وحده." };
  return { ok: true, step: await advanceTransfer(String(jobId)) };
}
