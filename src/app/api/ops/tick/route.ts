import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/server/cron-auth";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { scheduledJobs, stores, platformPayments } from "@/db/schema";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { purgeExpiredDrafts } from "@/intake/purge";
import { retryPendingNotifications } from "@/intake/notify";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAuthorizedCron(req))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

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

  // استمارات طلب متجر بدأها أصحابها ولم تُرسل حتى انتهت مهلتها: تُحذف مع ملفاتها (لا نحتفظ ببيانات لم تُرسل).
  const purged = await purgeExpiredDrafts().catch((e) => {
    console.error("[ops/tick] intake purge failed", e);
    return { requests: 0, files: 0, deferred: 0 };
  });
  // طلبات متجر فشل بريد فريقها أو عميلها (أو توقفت الدالة قبل الإرسال): تُعاد المحاولة ولا يبقى طلب بلا تنبيه.
  const retriedNotifications = await retryPendingNotifications().catch((e) => {
    console.error("[ops/tick] intake notify retry failed", e);
    return 0;
  });

  const alerts: string[] = [];
  if ((stuck?.c ?? 0) > 5) alerts.push(`${stuck!.c} مهمة QStash متأخرة`);
  if ((overdueReview?.c ?? 0) > 0) alerts.push(`${overdueReview!.c} متجر مراجعته متأخرة`);
  if (purged.deferred > 0) alerts.push(`${purged.deferred} مسودة طلب لم تُحذف: تعذر حذف ملفاتها من UploadThing (تُعاد غداً)`);
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
    purgedDrafts: purged,
    retriedNotifications,
  });
}

// جداول QStash ترسل POST افتراضياً (Railway أو Render بلا Vercel Cron): نفس المنطق ونفس التحقق.
export const POST = GET;