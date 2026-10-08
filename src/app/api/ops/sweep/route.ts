import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/server/cron-auth";
import { Client } from "@upstash/qstash";
import { and, asc, eq, inArray, isNotNull, lt, or } from "drizzle-orm";
import { db } from "@/db/client";
import { scheduledJobs } from "@/db/schema";
import { env, clientEnv } from "@/lib/env";
import { purgeOwnedStores } from "@/server/ownership/transfer";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;
const RUNNING_STALE_MS = 10 * 60_000;

export async function GET(req: Request) {
  if (!(await isAuthorizedCron(req))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

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
      { ok: false, stage: "query", error: String((e as any)?.message ?? e).slice(0, 300) },
      { status: 500 }
    );
  }

  // متاجر استلمها أصحابها وانتهت مهلة الأمان: تُحذف بياناتها وصورها من المنصة.
  const purge = await purgeOwnedStores().catch(() => ({ purged: [] as string[] }));

  if (!jobs.length) {
    return NextResponse.json({ ok: true, recovered: 0, failed: 0, total: 0, purged: purge.purged.length });
  }

  let client: Client;
  try {
    client = new Client({ token: env.QSTASH_TOKEN });
  } catch (e) {
    return NextResponse.json(
      { ok: false, stage: "qstash_init", error: String((e as any)?.message ?? e).slice(0, 300) },
      { status: 500 }
    );
  }

  let recovered = 0;
  let failed = 0;
  const errors: string[] = [];

  await Promise.all(
    jobs.map(async (job) => {
      if (!job.storeId) return;
      try {
        const r = await client.publishJSON({
          url: `${clientEnv.NEXT_PUBLIC_APP_URL}/api/jobs/lifecycle`,
          body: { storeId: job.storeId, kind: job.kind, jobId: job.id },
          headers: { "x-internal": env.QSTASH_INTERNAL_SECRET },
          retries: 3,
        });
        await db
          .update(scheduledJobs)
          .set({ qstashMessageId: r.messageId })
          .where(eq(scheduledJobs.id, job.id));
        recovered++;
      } catch (e) {
        failed++;
        const msg = String((e as any)?.message ?? e).slice(0, 200);
        errors.push(`${job.kind}/${job.id.slice(0, 8)}: ${msg}`);
        console.error("[ops/sweep] republish failed", job.id, e);
      }
    })
  );

  return NextResponse.json({
    ok: true,
    recovered,
    failed,
    total: jobs.length,
    purged: purge.purged.length,
    ...(errors.length ? { errors: errors.slice(0, 5) } : {}),
  });
}

export const POST = GET;