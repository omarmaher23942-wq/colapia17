import "server-only";
// domains.ts — ربط النطاق الخاص (المرحلة 7، وCloudflare في 14-ب.7): فحص DNS حي عبر DNS-over-HTTPS (يعمل على أي
// استضافة بلا مفتاح)، وإضافة النطاق آلياً لمزود الاستضافة: Cloudflare for SaaS إن ضُبط CF_API_TOKEN + CF_ZONE_ID،
// وإلا Vercel إن ضُبط VERCEL_TOKEN + VERCEL_PROJECT_ID، وإلا يضيفه المالك يدوياً ويؤكد. وخريطة النطاق ← المتجر في Redis
// ليقرأها الوسيط بلا قاعدة: cd:<host> = النطاق الفرعي للمتجر، وcdr:<sub> = النطاق الخاص (للتحويل إليه).
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { env } from "@/lib/env";
import { redis } from "@/lib/redis";
import { dohQuery, DNS_TYPE } from "@/server/doh";
import { dnsPointsToUs, isApex, VERCEL_TARGET, type DnsLookup, type DomainTarget } from "@/lib/custom-domain";

type Store = typeof stores.$inferSelect;

const cloudflareConfigured = () => Boolean(env.CF_API_TOKEN && env.CF_ZONE_ID);
const vercelConfigured = () => Boolean(env.VERCEL_TOKEN && env.VERCEL_PROJECT_ID);

/** هل الاستضافة على Cloudflare (السجلات التي يراها التاجر تتبعها)؟ رقم المنطقة وحده يكفي للعرض. */
const onCloudflare = () => Boolean(env.CF_ZONE_ID);

/** الوجهة التي يشير إليها التاجر بسجلاته. */
export function domainTarget(): DomainTarget {
  return onCloudflare() ? { kind: "cloudflare", cname: env.CF_SAAS_TARGET ?? `customers.${env.ROOT_DOMAIN}` } : VERCEL_TARGET;
}

/** هل تُضاف النطاقات آلياً (بتوكن المزود) أم يدوياً بيد المالك؟ */
export const domainAutoConfigured = () => (onCloudflare() ? cloudflareConfigured() : vercelConfigured());

const hostsOf = (domain: string) => (isApex(domain) ? [domain, `www.${domain}`] : [domain]);

/** فحص DNS عبر DNS-over-HTTPS (server/doh.ts): استعلام A يعيد سلسلة CNAME والعناوين معاً. */
export async function lookupDns(domain: string): Promise<DnsLookup | null> {
  const ans = await dohQuery(domain, "A");
  if (!ans) return null;
  return { a: ans.filter((x) => x.type === DNS_TYPE.A).map((x) => x.data), cname: ans.filter((x) => x.type === DNS_TYPE.CNAME).map((x) => x.data.replace(/\.$/, "")) };
}

// ─── Cloudflare for SaaS (Custom Hostnames) ─────────────────────────────────

type CfHostname = { id: string; hostname: string; status: string; ssl?: { status?: string } };

async function cf(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/custom_hostnames${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
}

async function cfFind(hostname: string): Promise<CfHostname | null> {
  const r = await cf(`?hostname=${encodeURIComponent(hostname)}`).catch(() => null);
  if (!r?.ok) return null;
  const body = (await r.json().catch(() => ({}))) as { result?: CfHostname[] };
  return body.result?.find((h) => h.hostname === hostname) ?? null;
}

async function cfAdd(hostname: string): Promise<{ ok: boolean; error?: string }> {
  const r = await cf("", {
    method: "POST",
    // التحقق والشهادة بطريقة HTTP: تكتمل وحدها متى أشار سجل العميل إلينا (بلا سجل TXT إضافي).
    body: JSON.stringify({ hostname, ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } } }),
  }).catch(() => null);
  if (!r) return { ok: false, error: "تعذرت إضافة النطاق الآن، سنتولى الأمر" };
  if (r.ok) return { ok: true };
  const body = (await r.json().catch(() => ({}))) as { errors?: { code?: number; message?: string }[] };
  // 1406 = النطاق مضاف بالفعل لمنطقتنا (ليس خطأ).
  if (body.errors?.some((e) => e.code === 1406 || /already exists/i.test(e.message ?? ""))) return { ok: true };
  console.error("[domains] cloudflare add failed", hostname, r.status, body.errors);
  return { ok: false, error: "تعذرت إضافة النطاق الآن، سنتولى الأمر" };
}

/** مضاف وشهادته صادرة (يعمل https). null = لا نعرف (تعذر الاستعلام). */
async function cfActive(hostname: string): Promise<boolean | null> {
  const h = await cfFind(hostname);
  if (!h) return null;
  return h.status === "active" && h.ssl?.status === "active";
}

// ─── Vercel ─────────────────────────────────────────────────────────────────

async function vercel(path: string, init?: RequestInit): Promise<Response> {
  const team = env.VERCEL_TEAM_ID ? `${path.includes("?") ? "&" : "?"}teamId=${env.VERCEL_TEAM_ID}` : "";
  return fetch(`https://api.vercel.com${path}${team}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
}

async function vercelAdd(name: string): Promise<{ ok: boolean; error?: string }> {
  const r = await vercel(`/v10/projects/${env.VERCEL_PROJECT_ID}/domains`, { method: "POST", body: JSON.stringify({ name }) }).catch(() => null);
  if (!r) return { ok: false, error: "تعذرت إضافة النطاق الآن، سنتولى الأمر" };
  if (!r.ok && r.status !== 409) {
    const body = (await r.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    if (body.error?.code !== "domain_already_in_use_by_project" && body.error?.code !== "domain_already_exists") {
      console.error("[domains] vercel add failed", name, r.status, body.error);
      return { ok: false, error: "تعذرت إضافة النطاق الآن، سنتولى الأمر" };
    }
  }
  return { ok: true };
}

/** هل تحقق Vercel من النطاق؟ فشل الاستعلام = لا نعرف (null). */
async function vercelVerified(domain: string): Promise<boolean | null> {
  const r = await vercel(`/v9/projects/${env.VERCEL_PROJECT_ID}/domains/${domain}`).catch(() => null);
  if (!r?.ok) return null;
  const body = (await r.json().catch(() => ({}))) as { verified?: boolean };
  return body.verified ?? null;
}

// ─── واجهة موحدة ────────────────────────────────────────────────────────────

/** يضيف النطاق (ونسخة www للجذري) لمزود الاستضافة. "manual" = بلا توكن: المالك يضيفه يدوياً. */
export async function addDomainHostnames(domain: string): Promise<{ ok: boolean; error?: string }> {
  if (!domainAutoConfigured()) return { ok: false, error: "manual" };
  const add = onCloudflare() ? cfAdd : vercelAdd;
  for (const h of hostsOf(domain)) {
    const r = await add(h);
    if (!r.ok) return r;
  }
  return { ok: true };
}

export async function removeDomainHostnames(domain: string): Promise<void> {
  if (!domainAutoConfigured()) return;
  for (const h of hostsOf(domain)) {
    if (onCloudflare()) {
      const found = await cfFind(h);
      if (found) await cf(`/${found.id}`, { method: "DELETE" }).catch(() => null);
    } else {
      await vercel(`/v9/projects/${env.VERCEL_PROJECT_ID}/domains/${h}`, { method: "DELETE" }).catch(() => null);
    }
  }
}

/** هل يعمل النطاق عند المزود (مضاف ومتحقق وشهادته صادرة)؟ null = لا نعرف (يدوي أو تعذر الاستعلام). */
async function providerVerified(domain: string): Promise<boolean | null> {
  if (!domainAutoConfigured()) return null;
  return onCloudflare() ? cfActive(domain) : vercelVerified(domain);
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
 * يفحص النطاق ويحدّث حالته: pending (DNS لا يشير إلينا) ← awaiting_team (يشير إلينا لكن لم يُضَف عند المزود بعد: يدوياً
 * بلا توكن، والمالك يؤكد الإضافة من لوحته) ← active (يُفعَّل في الوسيط). بتوكن المزود: active متى تحقق المزود وصدرت
 * الشهادة. على Cloudflare يُعتد بحالة المزود وحدها أيضاً (الجذري المسطّح لا يظهر فيه CNAME).
 */
export async function checkStoreDomain(store: Store): Promise<{ status: StoreDomainStatus; dns: DnsLookup | null }> {
  if (!store.customDomain) return { status: "pending", dns: null };
  const auto = domainAutoConfigured();
  const r = await lookupDns(store.customDomain);
  const dnsPoints = Boolean(r && dnsPointsToUs(r, domainTarget()));
  const verified = auto && (dnsPoints || onCloudflare()) ? (await providerVerified(store.customDomain)) === true : false;
  const points = dnsPoints || verified;
  const added = auto ? verified : Boolean(store.customDomainVerifiedAt);
  const status: StoreDomainStatus = points && added ? "active" : points ? "awaiting_team" : "pending";
  const now = new Date();
  await db
    .update(stores)
    .set({ customDomainStatus: status, customDomainCheckedAt: now, ...(status === "active" && auto && !store.customDomainVerifiedAt ? { customDomainVerifiedAt: now } : {}), updatedAt: now })
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
