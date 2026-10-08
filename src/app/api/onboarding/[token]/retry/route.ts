// /api/onboarding/[token]/retry — إعادة بناء متجر تعثّر بناؤه، من شاشة البناء نفسها.
// يُسمح فقط إن كانت آخر مهمة بناء فاشلة والمتجر ما زال في مرحلة البناء، وبحد معدل.
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { buildJobs, onboardingSessions, stores } from "@/db/schema";
import { hashToken } from "@/onboarding/token";
import { startBuild } from "@/ai/build/start";
import { allow, clientIp } from "@/lib/ratelimit";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!(await allow("checkout", `build-retry:${clientIp(req.headers)}`))) return NextResponse.json({ error: "محاولات كثيرة، انتظر دقائق" }, { status: 429 });

  const [session] = await db.select().from(onboardingSessions).where(eq(onboardingSessions.tokenHash, hashToken(token))).limit(1);
  if (!session?.storeId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [store] = await db.select({ id: stores.id, status: stores.status }).from(stores).where(eq(stores.id, session.storeId)).limit(1);
  const [job] = await db.select().from(buildJobs).where(eq(buildJobs.storeId, session.storeId)).orderBy(desc(buildJobs.createdAt)).limit(1);
  if (!store || !job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (job.status !== "failed" || store.status !== "building") return NextResponse.json({ error: "البناء ليس متوقفاً" }, { status: 409 });

  try {
    const jobId = await startBuild({ storeId: store.id, intakeId: job.intakeId, conversationId: session.conversationId });
    log.info("store", "build_retried", { storeId: store.id, jobId });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "تعذّر إعادة البناء الآن، أعد المحاولة بعد دقيقة." }, { status: 503 });
  }
}
