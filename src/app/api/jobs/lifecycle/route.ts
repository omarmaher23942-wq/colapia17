import { NextResponse } from "next/server";
import { verifiedByQStash } from "@/server/qstash-verify";
import { z } from "zod";
import { env } from "@/lib/env";
import { JOB_KINDS } from "@/lifecycle/scheduler";
import { runJob } from "@/lifecycle/run";

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

  const out = await runJob({ jobId, storeId, kind });
  if (out.status === "not_claimable") return NextResponse.json({ skip: "not_claimable" });
  if (out.status === "failed") return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, kind, result: out.result });
});
