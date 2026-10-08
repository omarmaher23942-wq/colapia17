// GET /api/onboarding/[token]/status — حالة بناء المتجر الحية لشاشة البناء (بلا كاش).
// المراحل ونسبة التقدم مشتقة من سجل خطوات الـ workflow (summarizeBuild)، فلا تصل للواجهة حالة لا تعرفها.
import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { onboardingSessions, stores, buildJobs } from "@/db/schema";
import { hashToken } from "@/onboarding/token";
import { issueMagicLink } from "@/ai/lifecycle/deliver";
import { summarizeBuild, DEFAULT_STAGES } from "@/ai/build/stages";
import { storeUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const [session] = await db.select().from(onboardingSessions).where(eq(onboardingSessions.tokenHash, hashToken(token))).limit(1);
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });

  if (session.status !== "submitted" || !session.storeId) {
    return NextResponse.json({ status: "waiting_submission", progress: 0, steps: DEFAULT_STAGES }, { headers: NO_STORE });
  }

  const [[store], [job]] = await Promise.all([
    db.select().from(stores).where(eq(stores.id, session.storeId)).limit(1),
    db.select().from(buildJobs).where(eq(buildJobs.storeId, session.storeId)).orderBy(desc(buildJobs.createdAt)).limit(1),
  ]);

  const isDone = store?.status === "trial" || store?.status === "active" || store?.status === "review" || job?.status === "done";
  const isFailed = !isDone && job?.status === "failed";
  const { steps, progress } = summarizeBuild(job?.steps, { status: isDone ? "done" : job?.status });

  let adminUrl = "";
  if (isDone && store) {
    try {
      adminUrl = await issueMagicLink(store);
    } catch {
      adminUrl = storeUrl(store.subdomain, "/admin/login");
    }
  }

  return NextResponse.json(
    {
      status: isDone ? "ready" : isFailed ? "failed" : "building",
      progress,
      steps,
      subdomain: store?.subdomain,
      storeName: store?.name,
      storeUrl: store ? `${storeUrl(store.subdomain)}/?preview=owner` : "",
      adminUrl,
      ...(isFailed ? { error: "توقف البناء قبل اكتماله." } : {}),
    },
    { headers: NO_STORE }
  );
}
