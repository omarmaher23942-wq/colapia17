import "server-only";
// preview-clock.ts — عدّاد المعاينة المجانية (24 ساعة بالإعداد): يبدأ مرة واحدة عند أول فتح لرابط الإعداد، لا عند التسليم.
// البدء ذري: UPDATE ... WHERE trial_ends_at IS NULL AND status = 'setup' ... RETURNING، فيفوز فاتح واحد ولو فُتح الرابط من جهازين
// معاً، والمهام المجدولة (تذكيرات التجربة والتجميد والحذف) لا تُجدول إلا لمن فاز. دورة التجميد والحذف القائمة تعمل من trial_ends_at.
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { cancelJobs, JOB_KINDS, scheduleTrial, schedulePaymentInvite } from "@/lifecycle/scheduler";
import { lifecycleTimings, type LifecycleTimings } from "@/lifecycle/timings";
import { trialSchedule } from "@/lifecycle/timings-rules";
import { currentPricing } from "@/server/pricing";
import { invalidateStoreCache } from "@/lib/tenant";

export type ClockResult = { started: boolean; endsAt: Date | null };

export async function beginPreviewClock(storeId: string, opts: { timings?: LifecycleTimings; now?: Date } = {}): Promise<ClockResult> {
  const now = opts.now ?? new Date();
  const timings = opts.timings ?? (await lifecycleTimings());
  const plan = trialSchedule(now, timings);
  const price = (await currentPricing()).build.price;

  const [row] = await db
    .update(stores)
    .set({ demoStartedAt: now, demoExpiresAt: plan.freeze, trialEndsAt: plan.freeze, purgeAt: plan.purge, setupStartedAt: now, updatedAt: now })
    .where(and(eq(stores.id, storeId), eq(stores.status, "setup"), isNull(stores.trialEndsAt)))
    .returning();

  if (!row) {
    // سبقنا فاتح آخر (أو المتجر ليس بانتظار الإعداد): نعيد الموعد المحفوظ دون أي أثر جانبي.
    const [cur] = await db.select({ ends: stores.trialEndsAt }).from(stores).where(eq(stores.id, storeId)).limit(1);
    return { started: false, endsAt: cur?.ends ?? null };
  }

  if (row.priceLockedEgp == null) await db.update(stores).set({ priceLockedEgp: price }).where(eq(stores.id, storeId));
  // مهام «إعداد غير مكتمل» القديمة (تذكيرات وحذف) تنتهي بدء العدّاد؛ دورة التجربة وحدها تحكم من الآن.
  await cancelJobs(storeId, JOB_KINDS.filter((k) => k.startsWith("setup."))).catch((e) => console.error("[preview-clock] cancel setup jobs", e));
  await scheduleTrial(storeId, now, timings);
  await schedulePaymentInvite(storeId, now);
  await invalidateStoreCache(row).catch(() => {});
  return { started: true, endsAt: plan.freeze };
}
