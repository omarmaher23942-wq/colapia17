import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { aiDirectives, buildJobs, conversations, intakes, onboardingSessions, stores } from "@/db/schema";
import { startBuild } from "@/ai/build/start";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { submissionToIntake, type OwnerDirective } from "@/onboarding/to-intake";
import { richness } from "@/onboarding/richness";
import { cancelJobs } from "./scheduler";
import { recordEvent, transition, type StoreStatus } from "./machine";

export type ReleaseResult =
  | { started: true; jobId: string }
  | { started: false; reason: "not_found" | "not_allowed" | "stale" | "already_running" | "no_data" | "start_failed"; current?: StoreStatus };

const RELEASABLE: readonly StoreStatus[] = ["intake", "pending_review", "review", "building"];

/**
 * عتبة اعتبار الـ job "ميتاً". أي job في حالة queued/running استمر أكثر من
 * 10 دقائق يُعتبر تالفاً (workflow تعطل/انتهى timeout).
 *
 * السبب الجذري: الـ Upstash Workflow قد ينهار أثناء التنفيذ (network, OOM,
 * خطأ في step). في هذه الحالة يبقى الـ job في قاعدة البيانات بحالة running
 * للأبد، مما يمنع التاجر/الأونر من إعادة البناء بـ already_running. الحل:
 * نسمح بتجاوز الـ job إن كان قديماً بما يكفي.
 */
const STALE_JOB_MINUTES = 10;

function isJobStale(job: { status: string; startedAt: Date | null; createdAt: Date }): boolean {
  if (job.status === "failed" || job.status === "done") return true;
  const reference = job.startedAt ?? job.createdAt;
  const ageMs = Date.now() - reference.getTime();
  return ageMs > STALE_JOB_MINUTES * 60 * 1000;
}

export async function releaseToBuild(storeId: string, actor: string): Promise<ReleaseResult> {
  const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) return { started: false, reason: "not_found" };
  if (!RELEASABLE.includes(store.status)) return { started: false, reason: "not_allowed", current: store.status };

  const [session] = await db
    .select()
    .from(onboardingSessions)
    .where(and(eq(onboardingSessions.storeId, storeId), eq(onboardingSessions.status, "submitted")))
    .orderBy(desc(onboardingSessions.submittedAt))
    .limit(1);

  const [existingIntake] = await db
    .select({ id: intakes.id, conversationId: intakes.conversationId })
    .from(intakes)
    .where(eq(intakes.storeId, storeId))
    .limit(1);

  // المحادثة تُحسم من بيانات هذا المتجر نفسه (جلسته أو استمارته)، لا من conversations.storeId
  // الذي يشير لآخر متجر أنشأته المحادثة فقط.
  const conversationId = session?.conversationId ?? existingIntake?.conversationId;
  if (!conversationId) return { started: false, reason: "no_data" };
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv) return { started: false, reason: "no_data" };

  // 1) تجهيز الـ intake (حتمي) مع تعليمات الأونر
  let intakeId: string;
  let directivesCount = 0;
  if (session?.submission) {
    const dirs = await db
      .select()
      .from(aiDirectives)
      .where(and(eq(aiDirectives.storeId, storeId), eq(aiDirectives.enabled, true)));
    directivesCount = dirs.length;
    const mapped: OwnerDirective[] = dirs.map((d) => ({
      scope: d.scope,
      productId: d.productSourceId ?? undefined,
      instruction: d.instruction,
      imageUrls: d.imageUrls,
    }));
    const payload = submissionToIntake(session.submission, mapped);
    const now = new Date();
    const vals = {
      storeId,
      brief: payload.brief,
      products: payload.products,
      policies: payload.policies,
      assets: payload.assets,
      completeness: richness(session.submission),
      finalizedAt: now,
      updatedAt: now,
    };
    const [row] = await db
      .insert(intakes)
      .values({ conversationId: conv.id, ...vals })
      .onConflictDoUpdate({ target: intakes.storeId, set: vals })
      .returning({ id: intakes.id });
    if (!row) return { started: false, reason: "no_data" };
    intakeId = row.id;
  } else {
    if (!existingIntake) return { started: false, reason: "no_data" };
    intakeId = existingIntake.id;
  }

  // 2) الانتقال الذري
  if (store.status !== "building") {
    const t = await transition({
      storeId,
      to: "building",
      from: [store.status],
      actor,
      set: { buildStartedAt: new Date(), reviewDeadlineAt: null, deliverAt: null },
      reason: store.status === "review" ? "rebuild" : "released",
      data: { directives: directivesCount },
    });
    if (!t.ok) return { started: false, reason: t.reason, current: t.current };
    if (store.status === "review") {
      await cancelJobs(storeId, ["delivery.auto"]).catch((e) =>
        console.error("[release] cancel delivery failed", e)
      );
    }
  } else {
    const [job] = await db
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.storeId, storeId))
      .orderBy(desc(buildJobs.createdAt))
      .limit(1);

    if (job && !isJobStale(job)) {
      return { started: false, reason: "already_running" };
    }

    // الـ job قديم — نعتبره فاشلاً ونكمل.
    if (job && job.status !== "failed") {
      await db
        .update(buildJobs)
        .set({
          status: "failed",
          error: `stale_job: تجاوز ${STALE_JOB_MINUTES} دقيقة دون اكتمال`,
          finishedAt: new Date(),
        })
        .where(eq(buildJobs.id, job.id))
        .catch((err) => console.error("[release] mark stale job failed", err));

      await recordEvent({
        storeId,
        storeRef: store.subdomain,
        type: "build.stale_job_detected",
        actor,
        data: { jobId: job.id, staleMinutes: STALE_JOB_MINUTES },
      });
    }
  }

  // 3) بدء البناء
  try {
    const jobId = await startBuild({ storeId, intakeId, conversationId: conv.id });
    await db
      .update(conversations)
      .set({ stage: "building", updatedAt: new Date() })
      .where(eq(conversations.id, conv.id));
    await recordEvent({
      storeId,
      storeRef: store.subdomain,
      conversationId: conv.id,
      type: "build.requested",
      actor,
      data: { jobId, intakeId, directives: directivesCount },
    });
    return { started: true, jobId };
  } catch (e) {
    console.error("[release] startBuild failed", e);
    await recordEvent({
      storeId,
      storeRef: store.subdomain,
      type: "build.start_failed",
      actor,
      data: { error: String(e).slice(0, 300) },
    });
    await notifyAdmin(
      `فشل بدء بناء متجر ${store.subdomain}. أعد المحاولة من Pipeline`,
      { storeId }
    ).catch(() => {});
    return { started: false, reason: "start_failed" };
  }
}