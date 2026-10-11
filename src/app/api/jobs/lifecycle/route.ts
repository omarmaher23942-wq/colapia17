import { NextResponse } from "next/server";
import { verifiedByQStash } from "@/server/qstash-verify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { env } from "@/lib/env";
import { JOB_KINDS, claimJob, finishJob } from "@/lifecycle/scheduler";
import { HANDLERS } from "@/lifecycle/handlers";

export const maxDuration = 60;

const bodySchema = z.object({
  storeId: z.string().uuid(),
  kind: z.enum(JOB_KINDS),
  jobId: z.string().uuid().optional(),
});

export const POST = verifiedByQStash(async (req: Request) => {
  if (req.headers.get("x-internal") !== env.QSTASH_INTERNAL_SECRET) return new Response("forbidden", { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ skip: "bad_body" });
  const { storeId, kind, jobId } = parsed.data;

  const job = await claimJob({ jobId, storeId, kind });
  if (!job) return NextResponse.json({ skip: "not_claimable" });

  try {
    const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
    const result = store ? await HANDLERS[kind](store) : { skip: "store_not_found" };
    await finishJob(job.id, true);
    return NextResponse.json({ ok: true, kind, result });
  } catch (e) {
    console.error("[jobs/lifecycle] handler failed", kind, storeId, e);
    await finishJob(job.id, false, e);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }
});