// worker.ts — نقطة دخول Colapia على Cloudflare Workers: عامل OpenNext كما هو (fetch) + المهام المجدولة (scheduled)
// بدل Vercel Cron وجداول QStash. المهمة تستدعي مسار المنصة نفسه داخلياً بسر CRON_SECRET (لا طلب عبر الإنترنت).
// @ts-expect-error — يُولَّد عند البناء (opennextjs-cloudflare build).
import { default as handler } from "../.open-next/worker.js";

type Env = { CRON_SECRET?: string; ROOT_DOMAIN?: string };
type Ctx = { waitUntil(p: Promise<unknown>): void };

const JOBS: Record<string, string> = {
  "*/10 * * * *": "/api/ops/sweep",
  "0 4 * * *": "/api/ops/tick",
};

export default {
  fetch: handler.fetch,
  async scheduled(event: { cron: string }, env: Env, ctx: Ctx) {
    const path = JOBS[event.cron];
    if (!path || !env.CRON_SECRET) {
      console.error(`[cron] ${!path ? `unknown schedule ${event.cron}` : "CRON_SECRET is not set"}`);
      return;
    }
    const req = new Request(`https://${env.ROOT_DOMAIN ?? "colapia.com"}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    ctx.waitUntil(
      handler.fetch(req, env, ctx).then(async (r: Response) => {
        if (!r.ok) console.error(`[cron] ${path} → ${r.status} ${(await r.text()).slice(0, 300)}`);
      })
    );
  },
};
