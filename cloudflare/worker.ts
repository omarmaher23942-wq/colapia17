// worker.ts — نقطة دخول Colapia على Cloudflare Workers: عامل OpenNext (fetch) + المهام المجدولة (scheduled) بدل
// Vercel Cron وجداول QStash + خدمة ملفات المتاجر على media.<النطاق> من R2 (media.ts). المهمة المجدولة تستدعي مسار
// المنصة نفسه داخلياً بسر CRON_SECRET (لا طلب عبر الإنترنت).
// @ts-expect-error — يُولَّد عند البناء (opennextjs-cloudflare build).
import { default as handler } from "../.open-next/worker.js";
import { serveMedia, type MediaEnv } from "./media";

type Env = { CRON_SECRET?: string } & MediaEnv;
type Ctx = { waitUntil(p: Promise<unknown>): void };

const JOBS: Record<string, string> = {
  "*/10 * * * *": "/api/ops/sweep",
  "0 4 * * *": "/api/ops/tick",
};

export default {
  async fetch(request: Request, env: Env, ctx: Ctx) {
    return (await serveMedia(request, env, ctx)) ?? handler.fetch(request, env, ctx);
  },
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
