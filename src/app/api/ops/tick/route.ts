import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { isAuthorizedCron } from "@/server/cron-auth";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { scheduledJobs, stores, platformPayments, sessions } from "@/db/schema";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { checkPendingDomains } from "@/server/domains";
import { sendMonthlyReports } from "@/server/monthly-report";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAuthorizedCron(req))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  // نبضة لمركز جاهزية الإطلاق: آخر تشغيل فعلي للمهمة المجدولة (تكشف جدولاً متوقفاً).
  await redis.set("ops:last:tick", new Date().toISOString(), { ex: 14 * 86400 }).catch(() => {});

  const [stuck] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(scheduledJobs)
    .where(sql`status = 'scheduled' AND run_at < now() - interval '1 hour'`);

  const [overdueReview] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(stores)
    .where(sql`status = 'pending_review' AND review_deadline_at < now() - interval '2 hours'`);

  const [stalePayments] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(platformPayments)
    .where(sql`status = 'under_review' AND created_at < now() - interval '24 hours'`);

  // نطاقات التجار الخاصة التي لم تُفعَّل بعد: فحص DNS دوري يفعّلها تلقائياً متى أشارت إلينا.
  const domainsActivated = await checkPendingDomains().catch((e) => {
    console.error("[ops/tick] domain checks failed", e);
    return 0;
  });

  // التقرير الشهري لأصحاب المتاجر المدفوعة (الأيام 1–3 من الشهر، مرة لكل متجر).
  const monthlyReports = await sendMonthlyReports().catch((e) => {
    console.error("[ops/tick] monthly reports failed", e);
    return 0;
  });

  // جلسات منتهية (تاجر، فريق، زبون): تُحذف حتى لا يتضخم الجدول.
  const expiredSessions = await db
    .delete(sessions)
    .where(sql`${sessions.expiresAt} < now()`)
    .returning({ id: sessions.id })
    .then((r) => r.length)
    .catch((e) => {
      console.error("[ops/tick] session cleanup failed", e);
      return 0;
    });

  const alerts: string[] = [];
  if ((stuck?.c ?? 0) > 5) alerts.push(`${stuck!.c} مهمة QStash متأخرة`);
  if ((overdueReview?.c ?? 0) > 0) alerts.push(`${overdueReview!.c} متجر مراجعته متأخرة`);
  if ((stalePayments?.c ?? 0) > 0) alerts.push(`${stalePayments!.c} إيصال دفع بانتظار مراجعة أكثر من 24 ساعة`);

  if (alerts.length) {
    await notifyAdmin(`Heartbeat: ${alerts.join(" · ")}`, {
      stuck: stuck?.c ?? 0,
      overdueReview: overdueReview?.c ?? 0,
      stalePayments: stalePayments?.c ?? 0,
    }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    alerts,
    stuck: stuck?.c ?? 0,
    overdueReview: overdueReview?.c ?? 0,
    stalePayments: stalePayments?.c ?? 0,
    domainsActivated,
    monthlyReports,
    expiredSessions,
  });
}

// جداول QStash ترسل POST افتراضياً (Railway أو Render بلا Vercel Cron): نفس المنطق ونفس التحقق.
export const POST = GET;