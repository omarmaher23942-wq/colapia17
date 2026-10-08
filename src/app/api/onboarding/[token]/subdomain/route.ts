import { z } from "zod";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { redis } from "@/lib/redis";
import { RESERVED_SUBDOMAINS } from "@/lib/subdomains";
import { checkSubdomain, releaseSubdomain, RE } from "@/onboarding/subdomain";
import { clientIp, json, rateLimit, requireActiveSession } from "@/onboarding/guard";

const body = z.object({ subdomain: z.string().max(60) });
const HOLD_TTL_S = 3600;

async function suggest(base: string): Promise<string[]> {
  const b = base.slice(0, 24).replace(/-+$/, "");
  const cands = [`${b}-eg`, `${b}-store`, `${b}-shop`, `${b}2`].filter(
    (c) => RE.test(c) && !c.includes("--") && !RESERVED_SUBDOMAINS.has(c)
  );
  if (!cands.length) return [];
  const used = new Set((await db.select({ s: stores.subdomain }).from(stores).where(inArray(stores.subdomain, cands))).map((r) => r.s));
  return cands.filter((c) => !used.has(c)).slice(0, 3);
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!(await rateLimit(`onb:ip:${clientIp(req)}`, 240, 60))) return json({ error: "rate_limited" }, 429);

  const g = await requireActiveSession(token);
  if (!g.ok) return g.res;
  const { session } = g;
  if (!(await rateLimit(`onb:sub:${session.id}`, 40, 60))) return json({ error: "rate_limited", message: "استنى لحظة قبل ما تجرب اسم تاني." }, 429);

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  const sub = parsed.data.subdomain.trim().toLowerCase();

  const status = await checkSubdomain(sub, session.id);

  // حجز واحد فقط لكل جلسة: أي اسم سابق مختلف يُفرَج عنه فوراً
  const pk = `subsess:${session.id}`;
  const prev = await redis.get<string>(pk).catch(() => null);
  if (prev && prev !== sub) await releaseSubdomain(prev, session.id).catch(() => {});
  if (status === "ok") await redis.set(pk, sub, { ex: HOLD_TTL_S }).catch(() => {});
  else if (prev === sub) await redis.del(pk).catch(() => {});

  return json({ status, subdomain: sub, suggestions: status === "taken" ? await suggest(sub) : [] });
}