import "server-only";
// redesign.ts — إطلاق إعادة تصميم المتجر بالذكاء الاصطناعي وتتبع حالتها (Redis، 24 ساعة).
import { Client } from "@upstash/workflow";
import { env, clientEnv } from "@/lib/env";
import { redis } from "@/lib/redis";

export type RedesignState = {
  status: "running" | "done" | "failed";
  step?: "load" | "design" | "copy" | "save";
  startedAt: string;
  finishedAt?: string;
  concept?: string;
  error?: string;
};

const key = (storeId: string) => `redesign:${storeId}`;
/** عملية عالقة أكثر من 10 دقائق تُعتبر فاشلة، فلا يبقى الزر مقفلاً للأبد. */
const STALE_MS = 10 * 60_000;

export async function getRedesignState(storeId: string): Promise<RedesignState | null> {
  const s = (await redis.get(key(storeId)).catch(() => null)) as RedesignState | null;
  if (s?.status === "running" && Date.now() - Date.parse(s.startedAt) > STALE_MS) return { ...s, status: "failed", error: "انتهت المهلة" };
  return s;
}

export async function setRedesignState(storeId: string, patch: Partial<RedesignState>) {
  const cur = (await redis.get(key(storeId)).catch(() => null)) as RedesignState | null;
  const next = { ...(cur ?? { status: "running", startedAt: new Date().toISOString() }), ...patch } as RedesignState;
  await redis.set(key(storeId), next, { ex: 60 * 60 * 24 });
}

export async function startRedesign(storeId: string): Promise<void> {
  await redis.set(key(storeId), { status: "running", step: "load", startedAt: new Date().toISOString() } satisfies RedesignState, { ex: 60 * 60 * 24 });
  try {
    await new Client({ token: env.QSTASH_TOKEN }).trigger({
      url: `${clientEnv.NEXT_PUBLIC_APP_URL}/api/workflows/redesign`,
      body: { storeId, nonce: Date.now().toString(36) },
      headers: { "x-internal": env.QSTASH_INTERNAL_SECRET },
      retries: 1,
    });
  } catch (e) {
    await setRedesignState(storeId, { status: "failed", finishedAt: new Date().toISOString(), error: "تعذر بدء إعادة التصميم" });
    throw e;
  }
}
