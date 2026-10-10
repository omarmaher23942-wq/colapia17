import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { verifiedByQStash } from "@/server/qstash-verify";
import { Client } from "@upstash/qstash";
import { env, clientEnv } from "@/lib/env";
import { redis } from "@/lib/redis";
import { sleep } from "@/lib/utils";
import { handleInbound } from "@/ai/agents/closer/runtime";
import { emitConversationMessage } from "@/server/realtime/emitters";

export const maxDuration = 60;

const BATCH_WAIT_MS = 4_000;
const INBOX_TTL_S = 300;
const LOCK_TTL_S = 60;
const HARD_DEADLINE_MS = 52_000;
const MIN_ROUND_MS = 12_000;
const MAX_ROUNDS = 3;
const DRAIN_DELAY_S = 1;

const RELEASE_LUA = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;

let qstashClient: Client | null = null;
const qstash = () =>
  (qstashClient ??= new Client({ token: env.QSTASH_TOKEN }));

async function releaseLock(lockKey: string, token: string) {
  try {
    await redis.eval(RELEASE_LUA, [lockKey], [token]);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[agents/inbound] lock release failed", e);
  }
}

async function scheduleDrain(channel: string, senderId: string) {
  try {
    await qstash().publishJSON({
      url: `${clientEnv.NEXT_PUBLIC_APP_URL}/api/agents/inbound`,
      body: { channel, senderId, drain: true },
      headers: { "x-internal": env.QSTASH_INTERNAL_SECRET },
      delay: DRAIN_DELAY_S,
      retries: 3,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[agents/inbound] drain schedule failed", e);
  }
}

function parseItem(s: unknown): {
  channel?: string;
  senderId?: string;
  mid?: string;
  text?: string;
  timestamp?: number;
} | null {
  if (typeof s === "string") {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }
  return (s as never) ?? null;
}

const byTimestamp = (
  a: { timestamp?: number } | null,
  b: { timestamp?: number } | null
) => (Number(a?.timestamp) || 0) - (Number(b?.timestamp) || 0);

export const POST = verifiedByQStash(async (req: Request) => {
  const started = Date.now();
  if (req.headers.get("x-internal") !== env.QSTASH_INTERNAL_SECRET)
    return new Response("forbidden", { status: 403 });

  let ev: {
    channel?: "messenger" | "instagram";
    senderId?: string;
    mid?: string;
    text?: string;
    timestamp?: number;
    attachments?: { type: string; url?: string }[];
    drain?: boolean;
  };
  try {
    ev = await req.json();
  } catch {
    return NextResponse.json({ ok: true, ignored: "bad-json" });
  }
  if (!ev?.channel || !ev?.senderId)
    return NextResponse.json({ ok: true, ignored: "missing-fields" });

  const channel = ev.channel;
  const senderId = ev.senderId;
  const key = `inbox:${channel}:${senderId}`;
  const lockKey = `lock:${key}`;
  const isDrain = ev.drain === true;

  if (!isDrain) {
    const seenKey =
      typeof ev.mid === "string" && ev.mid ? `seen:mid:${ev.mid}` : null;
    if (
      seenKey &&
      !(await redis.set(seenKey, 1, { nx: true, ex: 86_400 }))
    ) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    try {
      await redis.rpush(key, JSON.stringify(ev));
      await redis.expire(key, INBOX_TTL_S);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[agents/inbound] enqueue failed", e);
      if (seenKey) await redis.del(seenKey).catch(() => {});
      return new Response("enqueue failed", { status: 500 });
    }
    await sleep(BATCH_WAIT_MS);
  }

  const token = randomUUID();
  const lock = await redis.set(lockKey, token, {
    nx: true,
    ex: LOCK_TTL_S,
  });
  if (!lock) return NextResponse.json({ ok: true, queued: true });

  let processed = 0;
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (HARD_DEADLINE_MS - (Date.now() - started) < MIN_ROUND_MS) break;
      const raw = await redis.lpop<unknown[]>(key, 50);
      if (!raw?.length) break;
      const items = raw
        .map(parseItem)
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort(byTimestamp) as {
        channel: "messenger" | "instagram";
        senderId: string;
        mid: string;
        timestamp: number;
        text?: string;
        attachments?: { type: string; url?: string }[];
      }[];
      if (!items.length) continue;

      // بث كل رسالة على Pusher (fire-and-forget) ليعرضها الأونر مباشرة.
      for (const it of items) {
        void emitConversationMessage(`web_${senderId}`, {
          conversationId: `web_${senderId}`,
          messageId: it.mid,
          role: "user",
          preview: (it.text ?? "[مرفق]").slice(0, 120),
          at: new Date().toISOString(),
        });
      }

      try {
        await handleInbound(channel, senderId, items as never);
        processed += items.length;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[agents/inbound] handleInbound failed", e);
        break;
      }
    }
  } finally {
    await releaseLock(lockKey, token);
    try {
      if (await redis.llen(key)) await scheduleDrain(channel, senderId);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[agents/inbound] post-release check failed", e);
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    ms: Date.now() - started,
  });
});