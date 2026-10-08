import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Client } from "@upstash/qstash";
import { env, clientEnv } from "@/lib/env";
import { redis } from "@/lib/redis";

type Channel = "messenger" | "instagram";

type InboundAttachment = { type: string; url?: string };

type InboundPayload = {
  channel: Channel;
  senderId: string;
  mid: string;
  timestamp: number;
  text?: string;
  quickReply?: string;
  attachments: InboundAttachment[];
};

/** مدة تذكّر معرّف الرسالة لمنع التكرار من Meta */
const DEDUP_TTL_S = 86_400;

let qstashClient: Client | null = null;
const qstash = () => (qstashClient ??= new Client({ token: env.QSTASH_TOKEN }));

function resolveChannel(object: unknown): Channel | null {
  if (object === "instagram") return "instagram";
  if (object === "page") return "messenger";
  return null;
}

/** التحقق من توقيع Meta على البايتات الخام كما وصلت */
function validSignature(raw: Buffer, header: string | null): boolean {
  const secret = env.META_APP_SECRET;
  if (!header || !secret) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`, "utf8");
  const received = Buffer.from(header.trim(), "utf8");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function toPayload(channel: Channel, ev: any): InboundPayload | null {
  const senderId = ev?.sender?.id;
  if (!senderId) return null;
  const message = ev.message;
  const postback = ev.postback;
  if (!message && !postback) return null;
  if (message?.is_echo || message?.is_deleted) return null;

  const mid: string = message?.mid ?? postback?.mid ?? `pb_${ev.timestamp}_${senderId}`;
  const attachments: InboundAttachment[] = Array.isArray(message?.attachments)
    ? message.attachments.map((a: any) => ({
        type: String(a?.type ?? "unknown"),
        url: typeof a?.payload?.url === "string" ? a.payload.url : undefined,
      }))
    : [];

  return {
    channel,
    senderId: String(senderId),
    mid: String(mid),
    timestamp: Number(ev.timestamp) || Date.now(),
    text: message?.text ?? postback?.title,
    quickReply: message?.quick_reply?.payload ?? postback?.payload,
    attachments,
  };
}

/** يسجّل الرسالة كمُستلمة ثم ينشرها. لو فشل النشر نحذف علامة التكرار حتى تنجح إعادة إرسال Meta */
async function dispatch(p: InboundPayload): Promise<boolean> {
  const dedupKey = `meta:mid:${p.mid}`;
  const fresh = await redis.set(dedupKey, 1, { nx: true, ex: DEDUP_TTL_S });
  if (!fresh) return true; // تكرار من Meta

  try {
    await qstash().publishJSON({
      url: `${clientEnv.NEXT_PUBLIC_APP_URL}/api/agents/inbound`,
      body: p,
      headers: { "x-internal": env.QSTASH_INTERNAL_SECRET },
      deduplicationId: p.mid,
      retries: 3,
    });
    return true;
  } catch (e) {
    console.error("[webhooks/meta] publish failed", p.mid, e);
    await redis.del(dedupKey).catch(() => {});
    return false;
  }
}

/** GET: تحقق Meta عند تسجيل الـ Webhook */
export async function GET(req: Request) {
  const u = new URL(req.url);
  if (u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === env.META_VERIFY_TOKEN) {
    return new Response(u.searchParams.get("hub.challenge"), { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

/**
 * POST: أحداث الرسائل. نتحقق من التوقيع، نمنع التكرار، وننشر كل رسالة على QStash بالتوازي
 * (Meta تتوقع 200 خلال ثوانٍ). لو فشل نشر أي رسالة نعيد 500 لتعيد Meta الإرسال،
 * والرسائل التي نُشرت بنجاح تُتجاهل تلقائيًا في الإعادة بفضل علامة التكرار.
 */
export async function POST(req: Request) {
  const raw = Buffer.from(await req.arrayBuffer());
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new Response("bad signature", { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return NextResponse.json({ ok: true, ignored: "bad-json" });
  }

  const channel = resolveChannel(body?.object);
  if (!channel) return NextResponse.json({ ok: true, ignored: "unknown-object" });

  const payloads: InboundPayload[] = [];
  for (const entry of body?.entry ?? []) {
    for (const ev of entry?.messaging ?? []) {
      const p = toPayload(channel, ev);
      if (p) payloads.push(p);
    }
  }
  if (!payloads.length) return NextResponse.json({ ok: true, queued: 0 });

  const results = await Promise.allSettled(payloads.map(dispatch));
  const failed = results.filter((r) => r.status === "rejected" || !r.value).length;
  if (failed) return NextResponse.json({ ok: false, failed }, { status: 500 });

  return NextResponse.json({ ok: true, queued: payloads.length });
}
