import "server-only";
import { Client } from "@upstash/qstash";
import { and, eq, inArray, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { scheduledJobs } from "@/db/schema";
import { env } from "@/lib/env";
import { timingsFrom, trialSchedule, type LifecycleTimings } from "./timings-rules";

export const JOB_KINDS = [
  "delivery.auto",
  "review.auto_release",   // 12 ساعة بعد الاستمارة: إرسال تلقائي للبناء
  "review.reminder",       // تنبيه الأونر قبل انتهاء المؤقت بساعة
  "payment.invite",        // بعد التسليم بنصف ساعة
  "trial.reminder_6h",
  "trial.reminder_20h",
  "trial.freeze",
  "trial.last_chance",
  "trial.purge",
  "doom.reminder_12h",
  "doom.reminder_1h",
  "doom.purge",            // المسح النهائي بعد رفض الدفع
  "setup.link",            // رابط إعداد المتجر بعد إنشائه من المحادثة (بعد مهلة قابلة للضبط)
  "setup.reminder_24h",
  "setup.reminder_72h",
  "setup.purge",           // حذف المتجر الذي لم يكتمل إعداده بعد setupDays
] as const;
export type JobKind = (typeof JOB_KINDS)[number];

const MAX_ATTEMPTS = 5;
const RUNNING_STALE_MS = 10 * 60_000;
const H = 36e5;

let client: Client | null = null;
const q = () => (client ??= new Client({ token: env.QSTASH_TOKEN }));
const errText = (e: unknown) => String((e as { message?: unknown })?.message ?? e).slice(0, 300);

type JobRow = typeof scheduledJobs.$inferSelect;

async function cancelRows(rows: JobRow[]) {
  for (const r of rows) {
    if (r.qstashMessageId) {
      try {
        await q().messages.delete(r.qstashMessageId);
      } catch {}
    }
    // تفريغ dedupeKey يسمح بإعادة الجدولة لنفس الموعد لاحقاً
    await db.update(scheduledJobs).set({ status: "cancelled", dedupeKey: null }).where(eq(scheduledJobs.id, r.id));
  }
}

/**
 * يجدول مهمة. مهمة نشطة واحدة لكل (متجر، نوع): إعادة الجدولة بموعد مختلف تلغي القديمة.
 * الصف يُكتب أولاً، فإن فشل النشر على QStash يلتقطه الكنّاس لاحقاً (القاعدة مصدر الحقيقة).
 */
export async function schedule(storeId: string, kind: JobKind, runAt: Date, payload?: Record<string, unknown>): Promise<"scheduled" | "duplicate"> {
  const dedupeKey = `${storeId}:${kind}:${runAt.getTime()}`;
  const active = await db
    .select()
    .from(scheduledJobs)
    .where(and(eq(scheduledJobs.storeId, storeId), eq(scheduledJobs.kind, kind), eq(scheduledJobs.status, "scheduled")));

  if (active.some((j) => j.dedupeKey === dedupeKey)) return "duplicate";
  if (active.length) await cancelRows(active);

  const [row] = await db
    .insert(scheduledJobs)
    .values({ storeId, kind, runAt, dedupeKey, payload: payload ?? null })
    .onConflictDoNothing({ target: scheduledJobs.dedupeKey })
    .returning({ id: scheduledJobs.id });
  if (!row) return "duplicate";

  try {
    const r = await q().publishJSON({
      url: `https://${env.ROOT_DOMAIN}/api/jobs/lifecycle`,
      body: { storeId, kind, jobId: row.id },
      notBefore: Math.max(Math.floor(runAt.getTime() / 1000), Math.floor(Date.now() / 1000)),
      headers: { "x-internal": env.QSTASH_INTERNAL_SECRET },
      retries: 3,
    });
    await db.update(scheduledJobs).set({ qstashMessageId: r.messageId }).where(eq(scheduledJobs.id, row.id));
  } catch (e) {
    await db.update(scheduledJobs).set({ lastError: `publish: ${errText(e)}` }).where(eq(scheduledJobs.id, row.id));
    console.error("[scheduler] publish failed, sweeper will recover", kind, storeId, e);
  }
  return "scheduled";
}

export async function cancelJobs(storeId: string, kinds: readonly JobKind[]) {
  if (!kinds.length) return;
  const rows = await db
    .select()
    .from(scheduledJobs)
    .where(and(eq(scheduledJobs.storeId, storeId), eq(scheduledJobs.status, "scheduled"), inArray(scheduledJobs.kind, [...kinds])));
  await cancelRows(rows);
}

/**
 * يستدعيه الـ handler أول ما يبدأ: فائز واحد فقط بين QStash والكنّاس وإعادات المحاولة.
 * running لأكثر من 10 دقائق يُعتبر عالقاً ويمكن استلامه.
 */
export async function claimJob(ref: { jobId?: string; storeId: string; kind: JobKind }): Promise<{ id: string } | null> {
  const staleBefore = new Date(Date.now() - RUNNING_STALE_MS);
  const claimable = or(
    eq(scheduledJobs.status, "scheduled"),
    eq(scheduledJobs.status, "failed"),
    and(eq(scheduledJobs.status, "running"), lt(scheduledJobs.firedAt, staleBefore))
  );
  const target = ref.jobId
    ? eq(scheduledJobs.id, ref.jobId)
    : and(eq(scheduledJobs.storeId, ref.storeId), eq(scheduledJobs.kind, ref.kind));

  const [row] = await db
    .update(scheduledJobs)
    .set({ status: "running", firedAt: new Date(), attempts: sql`${scheduledJobs.attempts} + 1` })
    .where(and(target, claimable, lt(scheduledJobs.attempts, MAX_ATTEMPTS), lte(scheduledJobs.runAt, new Date(Date.now() + 60_000))))
    .returning({ id: scheduledJobs.id });
  return row ?? null;
}

export async function finishJob(id: string, ok: boolean, error?: unknown) {
  await db
    .update(scheduledJobs)
    .set({ status: ok ? "done" : "failed", lastError: ok ? null : errText(error) })
    .where(eq(scheduledJobs.id, id));
}

/* ───────────── مساعدات دورة الحياة ───────────── */

export const scheduleDelivery = (storeId: string, at: Date) => schedule(storeId, "delivery.auto", at);

/** مراجعة الأونر: إرسال تلقائي للـ AI بعد المهلة + تنبيه قبلها بساعة */
export async function scheduleReview(storeId: string, deadline: Date) {
  await schedule(storeId, "review.auto_release", deadline);
  const remind = new Date(deadline.getTime() - H);
  if (remind.getTime() > Date.now()) await schedule(storeId, "review.reminder", remind);
}

/**
 * بعد التسليم (نموذج الوكالة): تذكير «أفكار» في منتصف التجربة، وتذكير الدفع قبل نهايتها بساعتين، ثم الإيقاف عند
 * نهايتها، ثم «تنبيه أخير قبل الحذف»، ثم الحذف. المدد من lifecycle/timings.ts (قابلة للضبط من لوحة المالك).
 */
export async function scheduleTrial(storeId: string, deliveredAt: Date, timings?: LifecycleTimings) {
  const t = timings ?? timingsFrom(null, env.TRIAL_HOURS);
  const at = trialSchedule(deliveredAt, t);
  await Promise.all([
    schedule(storeId, "trial.reminder_6h", at.ideas),
    schedule(storeId, "trial.reminder_20h", at.pay),
    schedule(storeId, "trial.freeze", at.freeze),
    schedule(storeId, "trial.last_chance", at.lastChance),
    schedule(storeId, "trial.purge", at.purge),
  ]);
}

export const schedulePaymentInvite = (storeId: string, deliveredAt: Date) =>
  schedule(storeId, "payment.invite", new Date(deliveredAt.getTime() + env.PAYMENT_INVITE_DELAY_MIN * 60_000));

export async function scheduleDoom(storeId: string, doomAt: Date) {
  await schedule(storeId, "doom.purge", doomAt);
  for (const [kind, hoursBefore] of [["doom.reminder_12h", 12], ["doom.reminder_1h", 1]] as const) {
    const at = new Date(doomAt.getTime() - hoursBefore * H);
    if (at.getTime() > Date.now()) await schedule(storeId, kind, at);
  }
}