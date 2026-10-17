import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { isAuthorizedCron } from "@/server/cron-auth";
import { and, asc, eq, inArray, isNotNull, lt, or } from "drizzle-orm";
import { db } from "@/db/client";
import { scheduledJobs } from "@/db/schema";
import { runJob } from "@/lifecycle/run";
import { JOB_KINDS, type JobKind } from "@/lifecycle/scheduler";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;
const RUNNING_STALE_MS = 10 * 60_000;
/** ميزانية التشغيل داخل الطلب الواحد (الحد الأقصى للدالة 60 ثانية). */
const BUDGET_MS = 45_000;

const isKind = (k: string): k is JobKind => (JOB_KINDS as readonly string[]).includes(k);

/**
 * الكنّاس: يشغّل المهام المتأخرة داخل العملية نفسها (استلام ← معالج ← إنهاء).
 * QStash مسرّع فقط؛ إن لم تصل رسالته (جدار، مفاتيح، نطاق) تُنفَّذ المهمة هنا بعد دقيقتين من موعدها.
 */
export async function GET(req: Request) {
  if (!(await isAuthorizedCron(req))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  // نبضة لمركز جاهزية الإطلاق: آخر تشغيل فعلي للمهمة المجدولة (تكشف جدولاً متوقفاً).
  await redis.set("ops:last:sweep", new Date().toISOString(), { ex: 14 * 86400 }).catch(() => {});

  let jobs: (typeof scheduledJobs.$inferSelect)[] = [];
  try {
    const late = new Date(Date.now() - 2 * 60_000);
    const stale = new Date(Date.now() - RUNNING_STALE_MS);
    jobs = await db
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
      .limit(100);
  } catch (e) {
    console.error("[ops/sweep] query failed", e);
    return NextResponse.json(
      { ok: false, stage: "query", error: String((e as { message?: unknown })?.message ?? e).slice(0, 300) },
      { status: 500 }
    );
  }

  if (!jobs.length) return NextResponse.json({ ok: true, ran: 0, failed: 0, skipped: 0, total: 0 });

  const started = Date.now();
  let ran = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const job of jobs) {
    if (Date.now() - started > BUDGET_MS) break;
    if (!job.storeId || !isKind(job.kind)) {
      skipped++;
      continue;
    }
    const out = await runJob({ jobId: job.id, storeId: job.storeId, kind: job.kind });
    if (out.status === "done") ran++;
    else if (out.status === "failed") {
      failed++;
      errors.push(`${job.kind}/${job.id.slice(0, 8)}: ${out.error.slice(0, 160)}`);
    } else skipped++;
  }

  return NextResponse.json({
    ok: true,
    ran,
    failed,
    skipped,
    total: jobs.length,
    ...(errors.length ? { errors: errors.slice(0, 5) } : {}),
  });
}

// جداول QStash ترسل POST افتراضياً (Railway أو Render بلا Vercel Cron): نفس المنطق ونفس التحقق.
export const POST = GET;
