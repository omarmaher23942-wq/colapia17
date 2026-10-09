import "server-only";
import { Client } from "@upstash/qstash";
import { and, asc, eq, inArray, isNotNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { scheduledJobs } from "@/db/schema";
import { env, clientEnv } from "@/lib/env";

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
  "own.reminder_24h",      // قبل انتهاء مهلة نقل المتجر المدفوع بيوم
  "own.deadline",          // انتهت المهلة: المتجر يتوقف عن استقبال الطلبات حتى يكتمل النقل
  "own.purge_warning",     // قبل حذف بيانات متجر لم يُنقل بثلاثة أيام
  "own.purge",             // حذف بيانات متجر مدفوع لم يُنقل بعد المهلة الإضافية
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
      url: `${clientEnv.NEXT_PUBLIC_APP_URL}/api/jobs/lifecycle`,
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

/** للكنّاس: مهام تأخرت عن موعدها بأكثر من دقيقتين. يتجاهل الصفوف القديمة بلا dedupeKey */
export async function dueJobs(limit = 50) {
  const late = new Date(Date.now() - 2 * 60_000);
  const stale = new Date(Date.now() - RUNNING_STALE_MS);
  return db
    .select()
    .from(scheduledJobs)
    .where(
      and(
        isNotNull(scheduledJobs.dedupeKey),
        lt(scheduledJobs.attempts, MAX_ATTEMPTS),
        or(
          and(inArray(scheduledJobs.status, ["scheduled", "failed"]), lt(scheduledJobs.runAt, late)),
          and(eq(scheduledJobs.status, "running"), lt(scheduledJobs.firedAt, stale))
        )
      )
    )
    .orderBy(asc(scheduledJobs.runAt))
    .limit(limit);
}

/* ───────────── مساعدات دورة الحياة ───────────── */

export const scheduleDelivery = (storeId: string, at: Date) => schedule(storeId, "delivery.auto", at);

/** مراجعة الأونر: إرسال تلقائي للـ AI بعد المهلة + تنبيه قبلها بساعة */
export async function scheduleReview(storeId: string, deadline: Date) {
  await schedule(storeId, "review.auto_release", deadline);
  const remind = new Date(deadline.getTime() - H);
  if (remind.getTime() > Date.now()) await schedule(storeId, "review.reminder", remind);
}

/** بعد التسليم: تذكيرات وتجميد وفرصة أخيرة وحذف (كما كانت) */
export async function scheduleTrial(storeId: string, deliveredAt: Date) {
  const h = (n: number) => new Date(deliveredAt.getTime() + n * H);
  const d = (n: number) => new Date(deliveredAt.getTime() + n * 24 * H);
  await Promise.all([
    schedule(storeId, "trial.reminder_6h", h(6)),
    schedule(storeId, "trial.reminder_20h", h(env.TRIAL_HOURS - 4)),
    schedule(storeId, "trial.freeze", h(env.TRIAL_HOURS)),
    schedule(storeId, "trial.last_chance", d(3)),
    schedule(storeId, "trial.purge", d(env.GRACE_DAYS)),
  ]);
}

export const schedulePaymentInvite = (storeId: string, deliveredAt: Date) =>
  schedule(storeId, "payment.invite", new Date(deliveredAt.getTime() + env.PAYMENT_INVITE_DELAY_MIN * 60_000));

/** عداد الـ 24 ساعة بعد رفض الدفع: مسح نهائي + تذكيران اختياريان للعميل */
/** مهام مهلة نقل المتجر المدفوع (lib/ownership-window.ts)، تُجدول عند قبول الدفع. */
export async function scheduleOwnership(storeId: string, deadline: Date, purgeAt: Date) {
  const now = Date.now();
  const jobs: [JobKind, Date][] = [
    ["own.reminder_24h", new Date(deadline.getTime() - 24 * H)],
    ["own.deadline", deadline],
    ["own.purge_warning", new Date(purgeAt.getTime() - 3 * 24 * H)],
    ["own.purge", purgeAt],
  ];
  for (const [kind, at] of jobs) if (at.getTime() > now) await schedule(storeId, kind, at);
}

export async function scheduleDoom(storeId: string, doomAt: Date) {
  await schedule(storeId, "doom.purge", doomAt);
  for (const [kind, hoursBefore] of [["doom.reminder_12h", 12], ["doom.reminder_1h", 1]] as const) {
    const at = new Date(doomAt.getTime() - hoursBefore * H);
    if (at.getTime() > Date.now()) await schedule(storeId, kind, at);
  }
}