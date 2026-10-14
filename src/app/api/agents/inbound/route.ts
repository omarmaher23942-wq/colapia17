import { NextResponse } from "next/server";
import { verifiedByQStash } from "@/server/qstash-verify";
import { env } from "@/lib/env";
import { trace } from "@/lib/meta-trace";
import { processInboundEvent, type InboundEvent } from "@/ai/agents/closer/inbound";

export const maxDuration = 60;

// مسار QStash: احتياط للمعالجة المباشرة من الـ webhook (انظر ai/agents/closer/inbound.ts).
export const POST = verifiedByQStash(async (req: Request) => {
  if (req.headers.get("x-internal") !== env.QSTASH_INTERNAL_SECRET) return new Response("forbidden", { status: 403 });
  // لا يُعالج هنا إلا ما يصل على نطاق المنصة نفسه: نشر آخر (مثل *.vercel.app القديم بمفاتيحه القديمة) كان يستقبل الرسائل من QStash
  // ويفشل بمفاتيح منتهية فيصمت الوكيل. الرفض يجعل QStash يعيد المحاولة إلى النطاق الصحيح لا إلى ذلك النشر.
  const host = new URL(req.url).hostname.toLowerCase();
  const root = (env.ROOT_DOMAIN || "").toLowerCase();
  if (root && !root.startsWith("localhost") && host !== root && host !== `www.${root}`) {
    await trace("inbound-wrong-host", `رُفضت المعالجة على ${host} (النطاق الصحيح ${root})`);
    return new Response("wrong host", { status: 421 });
  }
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
