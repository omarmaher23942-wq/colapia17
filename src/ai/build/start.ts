import "server-only";
import { eq } from "drizzle-orm";
import { Client } from "@upstash/workflow";
import { env, clientEnv } from "@/lib/env";
import { db } from "@/db/client";
import { buildJobs } from "@/db/schema";

export type StartBuildInput = { storeId: string; intakeId: string; conversationId: string };

/**
 * يسجل مهمة البناء في build_jobs أولاً ثم يطلق Upstash Workflow.
 * إذا فشل الإطلاق تُعلَّم المهمة failed بسبب واضح ويُرمى الخطأ، فلا تبقى مهمة معلّقة بلا تنفيذ
 * ولا يُخبَر العميل ببدء لم يحدث.
 */
export async function startBuild(input: StartBuildInput): Promise<string> {
  const [job] = await db
    .insert(buildJobs)
    .values({ storeId: input.storeId, intakeId: input.intakeId, status: "queued" })
    .returning({ id: buildJobs.id });
  if (!job) throw new Error("build job insert returned no row");

  try {
    const client = new Client({ token: env.QSTASH_TOKEN });
    const { workflowRunId } = await client.trigger({
      url: `${clientEnv.NEXT_PUBLIC_APP_URL}/api/workflows/build`,
      body: { ...input, jobId: job.id },
      headers: { "x-internal": env.QSTASH_INTERNAL_SECRET },
      retries: 2,
    });
    await db.update(buildJobs).set({ workflowRunId }).where(eq(buildJobs.id, job.id));
    return job.id;
  } catch (e) {
    const reason = String((e as { message?: unknown })?.message ?? e).slice(0, 400);
    await db
      .update(buildJobs)
      .set({ status: "failed", error: `workflow trigger failed: ${reason}`, finishedAt: new Date() })
      .where(eq(buildJobs.id, job.id));
    throw e;
  }
}
