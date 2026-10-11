import "server-only";
// domains.ts — ربط النطاق الخاص (المرحلة 7): فحص DNS حي (يعمل دائماً، بلا أي مفتاح)، وإضافة النطاق لمشروع Vercel
// آلياً إن ضُبط VERCEL_TOKEN + VERCEL_PROJECT_ID (وإلا يضيفه المالك يدوياً)، وخريطة النطاق ← المتجر في Redis ليقرأها
// الوسيط (Edge) بلا قاعدة: cd:<host> = النطاق الفرعي للمتجر، وcdr:<sub> = النطاق الخاص (للتحويل إليه).
import { promises as dns } from "node:dns";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { env } from "@/lib/env";
import { redis } from "@/lib/redis";
import { dnsPointsToUs, isApex, type DnsLookup } from "@/lib/custom-domain";

type Store = typeof stores.$inferSelect;

export const vercelConfigured = () => Boolean(env.VERCEL_TOKEN && env.VERCEL_PROJECT_ID);

export async function lookupDns(domain: string): Promise<DnsLookup | null> {
  try {
    const [a, cname] = await Promise.all([dns.resolve4(domain).catch(() => [] as string[]), dns.resolveCname(domain).catch(() => [] as string[])]);
    return { a, cname };
  } catch {
    return null;
  }
}

async function vercel(path: string, init?: RequestInit): Promise<Response> {
  const team = env.VERCEL_TEAM_ID ? `${path.includes("?") ? "&" : "?"}teamId=${env.VERCEL_TEAM_ID}` : "";
  return fetch(`https://api.vercel.com${path}${team}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
}

/** يضيف النطاق (ونسخة www للجذري) لمشروع Vercel. 409 = موجود بالفعل (ليس خطأ). */
export async function addToVercel(domain: string): Promise<{ ok: boolean; error?: string }> {
  if (!vercelConfigured()) return { ok: false, error: "manual" };
  const names = isApex(domain) ? [domain, `www.${domain}`] : [domain];
  for (const name of names) {
    const r = await vercel(`/v10/projects/${env.VERCEL_PROJECT_ID}/domains`, { method: "POST", body: JSON.stringify({ name }) }).catch(() => null);
    if (!r) return { ok: false, error: "تعذر الوصول لـ Vercel" };
    if (!r.ok && r.status !== 409) {
      const body = (await r.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
      if (body.error?.code !== "domain_already_in_use_by_project" && body.error?.code !== "domain_already_exists") return { ok: false, error: body.error?.message?.slice(0, 160) ?? `Vercel ${r.status}` };
    }
  }
  return { ok: true };
}

export async function removeFromVercel(domain: string): Promise<void> {
  if (!vercelConfigured()) return;
  for (const name of isApex(domain) ? [domain, `www.${domain}`] : [domain]) {
    await vercel(`/v9/projects/${env.VERCEL_PROJECT_ID}/domains/${name}`, { method: "DELETE" }).catch(() => null);
  }
}

/** هل تحقق Vercel من النطاق (لا يُطلب إلا إن كان مضافاً بتوكن)؟ null = لا نعرف (يدوي). */
async function vercelVerified(domain: string): Promise<boolean | null> {
  if (!vercelConfigured()) return null;
  const r = await vercel(`/v9/projects/${env.VERCEL_PROJECT_ID}/domains/${domain}`).catch(() => null);
  if (!r?.ok) return null;
  const body = (await r.json().catch(() => ({}))) as { verified?: boolean };
  return body.verified ?? null;
}

export async function mapDomain(store: Pick<Store, "subdomain">, domain: string) {
  const hosts = isApex(domain) ? [domain, `www.${domain}`] : [domain];
  for (const h of hosts) await redis.set(`cd:${h}`, store.subdomain);
  await redis.set(`cdr:${store.subdomain}`, domain);
}

export async function unmapDomain(store: Pick<Store, "subdomain">, domain: string) {
  const hosts = isApex(domain) ? [domain, `www.${domain}`] : [domain];
  for (const h of hosts) await redis.del(`cd:${h}`);
  await redis.del(`cdr:${store.subdomain}`);
}

export type StoreDomainStatus = "pending" | "awaiting_team" | "active";

/**
 * يفحص النطاق ويحدّث حالته: pending (DNS لا يشير إلينا) ← awaiting_team (يشير إلينا لكن لم يُضَف للمشروع بعد: يدوياً
 * بلا توكن Vercel، والمالك يؤكد الإضافة من لوحته) ← active (يُفعَّل في الوسيط). بتوكن Vercel: active متى تحقق Vercel.
 */
export async function checkStoreDomain(store: Store): Promise<{ status: StoreDomainStatus; dns: DnsLookup | null }> {
  if (!store.customDomain) return { status: "pending", dns: null };
  const r = await lookupDns(store.customDomain);
  const points = Boolean(r && dnsPointsToUs(r));
  const added = vercelConfigured() ? (points ? (await vercelVerified(store.customDomain)) !== false : false) : Boolean(store.customDomainVerifiedAt);
  const status: StoreDomainStatus = points && added ? "active" : points ? "awaiting_team" : "pending";
  const now = new Date();
  await db
    .update(stores)
    .set({ customDomainStatus: status, customDomainCheckedAt: now, ...(status === "active" && vercelConfigured() && !store.customDomainVerifiedAt ? { customDomainVerifiedAt: now } : {}), updatedAt: now })
    .where(eq(stores.id, store.id));
  if (status === "active") await mapDomain(store, store.customDomain).catch((e) => console.error("[domains] map failed", e));
  else if (store.customDomainStatus === "active") await unmapDomain(store, store.customDomain).catch(() => {});
  return { status, dns: r };
}

/** فحص دوري لكل النطاقات غير المفعّلة (ops/tick). */
export async function checkPendingDomains(): Promise<number> {
  const rows = await db.select().from(stores).where(eq(stores.customDomainStatus, "pending"));
  const waiting = await db.select().from(stores).where(eq(stores.customDomainStatus, "awaiting_team"));
  let active = 0;
  for (const s of [...rows, ...waiting].slice(0, 100)) if ((await checkStoreDomain(s).catch(() => null))?.status === "active") active++;
  return active;
}
