import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { claimJob, finishJob, type JobKind } from "./scheduler";
import { HANDLERS } from "./handlers";

export type RunOutcome =
  | { status: "not_claimable" }
  | { status: "done"; result: unknown }
  | { status: "failed"; error: string };

/**
 * تشغيل مهمة دورة حياة داخل العملية: استلام (فائز واحد بين QStash والكنّاس) ← المعالج ← إنهاء.
 * QStash مسرّع فقط؛ ops/sweep يشغّل المتأخر بهذه الدالة نفسها فلا يتوقف شيء إن تعذّر وصول QStash.
 */
export async function runJob(ref: { jobId?: string; storeId: string; kind: JobKind }): Promise<RunOutcome> {
  const job = await claimJob(ref);
  if (!job) return { status: "not_claimable" };
  try {
    const [store] = await db.select().from(stores).where(eq(stores.id, ref.storeId)).limit(1);
    const result = store ? await HANDLERS[ref.kind](store) : { skip: "store_not_found" };
    await finishJob(job.id, true);
    return { status: "done", result };
  } catch (e) {
    console.error("[lifecycle/run] handler failed", ref.kind, ref.storeId, e);
    await finishJob(job.id, false, e);
    return { status: "failed", error: String((e as { message?: unknown })?.message ?? e).slice(0, 300) };
  }
}
