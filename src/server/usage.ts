import "server-only";
// usage.ts — حدود الاستخدام لكل متجر حسب باقته (V3-PLAN 3). الحدود من نموذج الأسعار (/admin/pricing)، والتجربة بحدود «النمو».
//  - الذكاء الاصطناعي: عدّاد شهري في Redis (بتوقيت القاهرة)، وإن تعذّر Redis فعدّ استدعاءات ai_calls الناجحة هذا الشهر.
//  - المساحة والفيديو: إجمالي ما في مساحة المتجر فعلاً (قائمة R2 بأحجامها، مخزّنة 15 دقيقة) + ما رُفع بعد آخر قراءة؛
//    وبلا R2 (مزوّد الملفات القديم) عدّاد تراكمي لما رُفع.
//  - المنتجات وأعضاء الفريق: العدد الفعلي من القاعدة. والنطاق الخاص: مسموح أم لا في الباقة.
// الرسائل للتاجر هادئة: ماذا استُخدم، ومتى يتجدد الحد، وأي باقة تتيح أكثر. تعذّر القراءة لا يمنع التاجر (حماية لا بوابة).
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/db/client";
import { aiCalls, storeMembers, stores } from "@/db/schema";
import { productsCount } from "@/server/repos/store-counts";
import { redis } from "@/lib/redis";
import { cairoMonthStart } from "@/lib/change-requests";
import { currentPricing } from "@/server/pricing";
import { fmtEgp, fmtStorage, type HostingPlan, type PlanId, type PlanLimits, type PricingModel } from "@/lib/platform-pricing";
import { meter, monthlyLimitMessage, planFor, storePlanId, totalLimitMessage, upgradeHint, usageMonth, type Meter, type PlanStore } from "@/lib/usage-limits";

export type AiKind = "import" | "describe" | "design" | "content" | "image";
export type UploadKind = "image" | "video";

const TTL = 40 * 86_400;
const STORAGE_TTL = 15 * 60;
const aiKey = (storeId: string, kind: AiKind | "total") => `usage:ai:${storeId}:${kind}:${usageMonth()}`;
/** ما رُفع منذ آخر قراءة لمساحة R2 (يُصفَّر مع كل قراءة)، أو الإجمالي التراكمي بلا R2. */
const pendingKey = (storeId: string, what: "bytes" | "videos") => `usage:store:${storeId}:pending:${what}`;
const scanKey = (storeId: string) => `usage:store:${storeId}:scan`;

export const AI_KIND_NAME: Record<AiKind, string> = { import: "استيراد المنتجات", describe: "كتابة الأوصاف", design: "تعديل الشكل بالوصف", content: "استوديو المحتوى", image: "قراءة الصور" };

export type QuotaResult = { ok: true; used: number; limit: number; remaining: number } | { ok: false; used: number; limit: number; remaining: 0; message: string };

export type StorePlan = { planId: PlanId; plan: HostingPlan; isTrial: boolean; limits: PlanLimits; model: PricingModel };

async function storeRow(storeId: string): Promise<PlanStore | null> {
  const [row] = await db.select({ status: stores.status, plan: stores.plan, prefs: stores.prefs }).from(stores).where(eq(stores.id, storeId)).limit(1).catch(() => []);
  return row ?? null;
}

/** باقة المتجر الفعلية وحدودها (المدفوع بباقته، وغيره بحدود التجربة). */
export async function storePlan(storeId: string): Promise<StorePlan> {
  const [row, model] = await Promise.all([storeRow(storeId), currentPricing()]);
  const { planId, isTrial } = storePlanId(row ?? { status: "trial" });
  const plan = planFor(model, planId);
  return { planId: plan.id, plan, isTrial, limits: plan.limits, model };
}

/** للتوافق: الحدود الفعلية للمتجر. */
export async function limitsForStore(storeId: string): Promise<PlanLimits> {
  return (await storePlan(storeId)).limits;
}

const num = async (key: string): Promise<number | null> => {
  try {
    return Number((await redis.get<number>(key)) ?? 0) || 0;
  } catch {
    return null;
  }
};

const fail = (used: number, limit: number, message: string): QuotaResult => ({ ok: false, used, limit, remaining: 0, message });
const pass = (used: number, limit: number): QuotaResult => ({ ok: true, used, limit, remaining: Math.max(0, limit - used) });

// ─── الذكاء الاصطناعي ───

async function aiUsed(storeId: string): Promise<number> {
  const v = await num(aiKey(storeId, "total"));
  if (v !== null) return v;
  const [r] = await db
    .select({ n: count() })
    .from(aiCalls)
    .where(and(eq(aiCalls.storeId, storeId), eq(aiCalls.ok, true), gte(aiCalls.createdAt, cairoMonthStart())))
    .catch(() => []);
  return Number(r?.n ?? 0);
}

export async function checkAiQuota(storeId: string, kind: AiKind, units = 1): Promise<QuotaResult> {
  const p = await storePlan(storeId);
  const limit = p.limits.aiPerMonth;
  const used = await aiUsed(storeId);
  if (used + units > limit) return fail(used, limit, monthlyLimitMessage(`العمليات التلقائية (${AI_KIND_NAME[kind]})`, limit, upgradeHint(p.model, p.planId, "aiPerMonth")));
  return pass(used, limit);
}

export async function recordAi(storeId: string, kind: AiKind, units = 1): Promise<void> {
  try {
    for (const k of [aiKey(storeId, kind), aiKey(storeId, "total")]) {
      await redis.incrby(k, units);
      await redis.expire(k, TTL);
    }
  } catch {
    /* العدّاد حماية فقط */
  }
}

// ─── المساحة والفيديو ───

type StorageUsage = { bytes: number; videos: number; measured: boolean };

/** مساحة المتجر الحالية: قراءة R2 المخزّنة (أو قراءة جديدة) + ما رُفع بعدها. */
export async function storageUsage(storeId: string, fresh = false): Promise<StorageUsage> {
  const [pb, pv] = await Promise.all([num(pendingKey(storeId, "bytes")), num(pendingKey(storeId, "videos"))]);
  let scan: { bytes: number; videos: number } | null = null;
  if (!fresh) scan = await redis.get<{ bytes: number; videos: number }>(scanKey(storeId)).catch(() => null);
  if (!scan) {
    const { prefixUsage } = await import("@/server/r2");
    const r = await prefixUsage(`stores/${storeId}/`, (k) => k.includes("/receipts/")).catch(() => null);
    if (r) {
      scan = { bytes: r.bytes, videos: r.videos };
      try {
        await redis.set(scanKey(storeId), scan, { ex: STORAGE_TTL });
        await redis.del(pendingKey(storeId, "bytes"), pendingKey(storeId, "videos"));
      } catch {
        /* القراءة القادمة تعيد الحساب */
      }
      return { ...scan, measured: true };
    }
  }
  if (scan) return { bytes: scan.bytes + (pb ?? 0), videos: scan.videos + (pv ?? 0), measured: true };
  // بلا R2: العدّاد التراكمي لما رُفع (pending لا يُصفَّر دون قراءة).
  return { bytes: pb ?? 0, videos: pv ?? 0, measured: false };
}

/** فحص رفع ملفات: حجم الفيديو الواحد، وعدد الفيديوهات، ومساحة الصور والفيديو الإجمالية في الباقة. */
export async function checkUploadQuota(storeId: string, bytes: number, kind: UploadKind, files = 1): Promise<QuotaResult> {
  const p = await storePlan(storeId);
  const l = p.limits;
  const perFile = files > 0 ? bytes / files : bytes;
  if (kind === "video" && perFile > l.videoMaxBytes) {
    return fail(Math.round(perFile), l.videoMaxBytes, `حجم الفيديو أكبر من المسموح في باقتكم (${fmtStorage(l.videoMaxBytes)}). اضغطوه أو اختاروا مقطعاً أقصر.${upgradeHint(p.model, p.planId, "videoMaxBytes") ? ` ${upgradeHint(p.model, p.planId, "videoMaxBytes")}` : ""}`);
  }
  const s = await storageUsage(storeId).catch(() => null);
  if (!s) return pass(0, l.storageBytes);
  if (kind === "video" && s.videos + files > l.videos) {
    return fail(s.videos, l.videos, totalLimitMessage("الفيديوهات", `${fmtEgp(l.videos)} فيديو`, upgradeHint(p.model, p.planId, "videos")));
  }
  if (s.bytes + bytes > l.storageBytes) {
    return fail(s.bytes, l.storageBytes, totalLimitMessage("مساحة الصور والفيديو", fmtStorage(l.storageBytes), upgradeHint(p.model, p.planId, "storageBytes")));
  }
  return pass(s.bytes, l.storageBytes);
}

export async function recordUpload(storeId: string, bytes: number, kind: UploadKind, files = 1): Promise<void> {
  try {
    await redis.incrby(pendingKey(storeId, "bytes"), Math.max(0, Math.round(bytes)));
    if (kind === "video") await redis.incrby(pendingKey(storeId, "videos"), Math.max(1, files));
  } catch {
    /* ignore */
  }
}

// ─── المنتجات والفريق والنطاق والبحث بالصورة ───

export { productsCount };

/** قبل إنشاء منتجات جديدة (إضافة يدوية أو استيراد): هل تتسع الباقة لـ adding منتجاً آخر؟ */
export async function checkProductsQuota(storeId: string, adding = 1): Promise<QuotaResult> {
  const [p, used] = await Promise.all([storePlan(storeId), productsCount(storeId)]);
  const limit = p.limits.products;
  if (used + adding > limit) {
    const room = Math.max(0, limit - used);
    const base = totalLimitMessage("المنتجات", `حتى ${fmtEgp(limit)} منتج`, upgradeHint(p.model, p.planId, "products"));
    return fail(used, limit, adding > 1 && room > 0 ? `يتسع متجركم لـ ${fmtEgp(room)} منتج آخر فقط. ${base}` : base);
  }
  return pass(used, limit);
}

export async function teamCount(storeId: string): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(storeMembers)
    .where(and(eq(storeMembers.storeId, storeId), eq(storeMembers.status, "active")))
    .catch(() => []);
  return Number(r?.n ?? 0);
}

/** قبل دعوة عضو جديد للفريق. */
export async function checkTeamQuota(storeId: string, adding = 1): Promise<QuotaResult> {
  const [p, used] = await Promise.all([storePlan(storeId), teamCount(storeId)]);
  const limit = p.limits.teamMembers;
  if (used + adding > limit) return fail(used, limit, totalLimitMessage("أعضاء الفريق", `${fmtEgp(limit)} أعضاء`, upgradeHint(p.model, p.planId, "teamMembers")));
  return pass(used, limit);
}

/** النطاق الخاص متاح في الباقة؟ (التجربة بحدود «النمو» فتتيحه.) */
export async function checkCustomDomain(storeId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const p = await storePlan(storeId);
  if (p.limits.customDomain) return { ok: true };
  return { ok: false, message: `ربط نطاق خاص غير متاح في باقة «${p.plan.name}». ${upgradeHint(p.model, p.planId, "customDomain")}`.trim() };
}

/** حد «البحث بالصورة» الشهري لزوار المتجر. */
export async function visualSearchLimit(storeId: string): Promise<number> {
  return (await storePlan(storeId)).limits.visualSearchPerMonth;
}

// ─── الملخص لصفحتي الاشتراك والاستخدام ───

export type UsageSummary = {
  isTrial: boolean;
  planId: PlanId;
  planName: string;
  limits: PlanLimits;
  ai: Meter;
  aiByKind: { kind: AiKind; name: string; used: number }[];
  visualSearch: Meter;
  storage: Meter;
  /** هل المساحة مقروءة فعلاً من مساحة الملفات (لا تقديراً من العدّاد). */
  storageMeasured: boolean;
  videos: Meter;
  products: Meter;
  team: Meter;
  customDomain: boolean;
  /** باقة أعلى تتيح أكثر (لتلميح الترقية)، أو null. */
  nextPlan: { id: PlanId; name: string } | null;
};

export async function usageSummary(storeId: string): Promise<UsageSummary> {
  const p = await storePlan(storeId);
  const kinds = Object.keys(AI_KIND_NAME) as AiKind[];
  // نفس مفتاح عدّاد server/visual-search.ts (الشهر بتوقيت القاهرة).
  const vsKey = `vs:count:${storeId}:${usageMonth()}`;
  const [aiTotal, storage, prodN, teamN, vsN, ...byKind] = await Promise.all([
    aiUsed(storeId),
    storageUsage(storeId).catch(() => ({ bytes: 0, videos: 0, measured: false })),
    productsCount(storeId),
    teamCount(storeId),
    num(vsKey),
    ...kinds.map((k) => num(aiKey(storeId, k))),
  ]);
  const idx = p.model.plans.findIndex((x) => x.id === p.planId);
  const next = p.model.plans[idx + 1] ?? null;
  return {
    isTrial: p.isTrial,
    planId: p.planId,
    planName: p.plan.name,
    limits: p.limits,
    ai: meter(aiTotal, p.limits.aiPerMonth),
    aiByKind: kinds.map((k, i) => ({ kind: k, name: AI_KIND_NAME[k], used: byKind[i] ?? 0 })).filter((x) => x.used > 0),
    visualSearch: meter(vsN ?? 0, p.limits.visualSearchPerMonth),
    storage: meter(storage.bytes, p.limits.storageBytes),
    storageMeasured: storage.measured,
    videos: meter(storage.videos, p.limits.videos),
    products: meter(prodN, p.limits.products),
    team: meter(teamN, p.limits.teamMembers),
    customDomain: p.limits.customDomain,
    nextPlan: next ? { id: next.id, name: next.name } : null,
  };
}
