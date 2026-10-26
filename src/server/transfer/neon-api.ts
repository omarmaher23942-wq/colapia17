// neon-api.ts — قاعدة مستقلة لكل متجر عبر Neon API (اختياري، مطفأ افتراضياً).
//
// العلم `store_db.per_store` في /admin/flags يجب أن يكون موجوداً ومفعّلاً صراحة (غيابه = مطفأ)، ويلزم NEON_API_KEY
// و NEON_PROJECT_ID. خطة Neon المجانية تحدّ عدد الفروع والمشاريع فهذا الخيار للخطة المدفوعة فقط (انظر docs/TRANSFER.md).
// ينشئ فرعاً بنقطة اتصال قراءة/كتابة، ثم يمر بمسار النقل نفسه (migrations ثم نسخ ثم تحويل التوجيه).
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { featureFlags, stores } from "@/db/schema";
import { log } from "@/lib/logger";
import { safeError } from "./url";
import { startTransfer, type StartResult } from "./index";

const API = "https://console.neon.tech/api/v2";
export const PER_STORE_FLAG = "store_db.per_store";

export async function perStoreDbEnabled(): Promise<boolean> {
  const [f] = await db.select({ enabled: featureFlags.enabled }).from(featureFlags).where(eq(featureFlags.key, PER_STORE_FLAG)).limit(1);
  return !!f?.enabled;
}

export function neonApiConfig(env: Record<string, string | undefined> = process.env): { key: string; projectId: string } | null {
  const key = env.NEON_API_KEY?.trim();
  const projectId = env.NEON_PROJECT_ID?.trim();
  return key && projectId ? { key, projectId } : null;
}

/** اسم فرع آمن ومميز للمتجر. */
export const branchNameFor = (storeId: string, subdomain: string) => `store-${subdomain.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30)}-${storeId.slice(0, 8)}`;

type CreateBranchResponse = { connection_uris?: { connection_uri?: string }[] };

/** ينشئ فرعاً جديداً ويعيد رابط الاتصال. يرمي بنص آمن (بلا أسرار) عند الفشل. */
export async function createBranchUrl(cfg: { key: string; projectId: string }, name: string, fetcher: typeof fetch = fetch): Promise<string> {
  const res = await fetcher(`${API}/projects/${encodeURIComponent(cfg.projectId)}/branches`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.key}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ branch: { name }, endpoints: [{ type: "read_write" }] }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const hint = res.status === 401 || res.status === 403 ? "مفتاح Neon API مرفوض" : res.status === 422 || res.status === 429 ? "حدود خطة Neon (عدد الفروع)" : `استجابة ${res.status}`;
    throw new Error(`تعذر إنشاء قاعدة المتجر: ${hint}.`);
  }
  const body = (await res.json()) as CreateBranchResponse;
  const uri = body.connection_uris?.[0]?.connection_uri;
  if (!uri) throw new Error("تعذر إنشاء قاعدة المتجر: لم يصل رابط الاتصال.");
  return uri;
}

/** يجهّز قاعدة مستقلة للمتجر ويبدأ نقل بياناته إليها. السائق يتابع الخطوات كما في نقل العميل. */
export async function provisionStoreDatabase(storeId: string): Promise<StartResult> {
  if (!(await perStoreDbEnabled())) return { ok: false, error: "قاعدة لكل متجر مطفأة (العلم store_db.per_store)." };
  const cfg = neonApiConfig();
  if (!cfg) return { ok: false, error: "مفتاح Neon API غير مضبوط (NEON_API_KEY و NEON_PROJECT_ID)." };
  const [store] = await db.select({ id: stores.id, subdomain: stores.subdomain }).from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) return { ok: false, error: "المتجر غير موجود." };
  try {
    const url = await createBranchUrl(cfg, branchNameFor(store.id, store.subdomain));
    return await startTransfer(store.id, url);
  } catch (e) {
    log.warn("store", "per_store_db_failed", { storeId }, safeError(e));
    return { ok: false, error: safeError(e) };
  }
}
