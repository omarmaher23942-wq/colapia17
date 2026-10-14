import { NextResponse } from "next/server";
import { verifiedByQStash } from "@/server/qstash-verify";
import { env } from "@/lib/env";
import { processInboundEvent, type InboundEvent } from "@/ai/agents/closer/inbound";

export const maxDuration = 60;

// مسار QStash: احتياط للمعالجة المباشرة من الـ webhook (انظر ai/agents/closer/inbound.ts).
export const POST = verifiedByQStash(async (req: Request) => {
  if (req.headers.get("x-internal") !== env.QSTASH_INTERNAL_SECRET) return new Response("forbidden", { status: 403 });
  let ev: InboundEvent;
  try {
    ev = await req.json();
  } catch {
    return NextResponse.json({ ok: true, ignored: "bad-json" });
  }
  const r = await processInboundEvent(ev, { batchWaitMs: 4_000, deadlineMs: 52_000 });
  if (!r.ok && "error" in r) return new Response(r.error, { status: 500 });
  return NextResponse.json(r);
});
