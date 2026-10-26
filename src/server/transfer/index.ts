// transfer/index.ts — «نقل البيانات»: ينسخ بيانات المتجر إلى قاعدة Neon الخاصة بالعميل ثم يحوّل التوجيه إليها.
//
// المراحل (تُستأنف عبر طلبات متتالية يقودها الزر في اللوحة، كل طلب بميزانية زمنية):
//   queued ← تجهيز الجداول (migrations ذرية) ← copying (نسخ والمتجر يعمل) ← syncing (طلبات متوقفة + مزامنة نهائية)
//   ← مطابقة أعداد كل جدول ← switching (تسجيل التوجيه المشفّر ذرياً) ← done.
// الرجوع (direction=back) هو المسار نفسه معكوساً (قاعدة العميل ← المنصة) ثم حذف التوجيه.
// لا يُسجَّل الرابط ولا يُعرض: يُخزَّن مشفّراً في المهمة حتى تنتهي ثم يبقى مشفّراً في التوجيه وحده.
import "server-only";
import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { stores, storeDatabases, storeDbTransfers } from "@/db/schema";
import { forgetTenantRoute } from "@/db/tenant";
import { redis } from "@/lib/redis";
import { hit } from "@/lib/rate-hit";
import { log } from "@/lib/logger";
import { invalidateStoreCache } from "@/lib/tenant";
import { COPY_PLAN, specByName } from "./plan";
import { copySteps, emptyProgress, percent, prepareProgress, verifyCounts, type CopyProgress, type PlanItem } from "./engine";
import { connectExternal, inspectTarget, makePorts, migrateTarget, platformConn, type Conn } from "./ports";
import { decryptSecret, encryptSecret } from "./crypto";
import { hostHint, safeError, validateDatabaseUrl } from "./url";
import { PURGE_PLAN, purgeTableName } from "@/server/store-purge-plan";

export const PLATFORM_COPY_DAYS = 7;
const STEP_BUDGET_MS = 25_000;
const STALE_MS = 10 * 60_000;

export type TransferStatus = "queued" | "copying" | "syncing" | "switching" | "done" | "failed";
type Direction = "forward" | "back";
type JobProgress = CopyProgress & { direction: Direction; resumeAt?: TransferStatus };
type Job = typeof storeDbTransfers.$inferSelect;

const BACK_SKIP = new Set(["merchants", "stores", "store_blueprints", "store_snapshots"]);
const planFor = (d: Direction): PlanItem[] => COPY_PLAN.filter((p) => d === "forward" || !BACK_SKIP.has(p.name)).map((p) => ({ name: p.name, optional: p.optional }));

export type StartResult = { ok: true; jobId: string } | { ok: false; error: string };

const jobProgress = (j: Job): JobProgress => ({ direction: "forward", ...emptyProgress(), ...(j.progress as Partial<JobProgress>) });

async function saveJob(id: string, patch: Partial<typeof storeDbTransfers.$inferInsert>) {
  await db.update(storeDbTransfers).set({ ...patch, updatedAt: new Date() }).where(eq(storeDbTransfers.id, id));
}

/** يبدأ نقلاً جديداً. الصلاحية (صاحب المتجر وحده) تُفرض في الإجراء الذي يستدعيه. */
export async function startTransfer(storeId: string, databaseUrl: string): Promise<StartResult> {
  const checked = validateDatabaseUrl(databaseUrl);
  if (!checked.ok) return checked;
  if (!(await hit(`transfer:start:${storeId}`, 6, 3600))) return { ok: false, error: "محاولات كثيرة. حاولوا بعد ساعة." };

  const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store || store.deletedAt) return { ok: false, error: "المتجر غير موجود." };
  const [routed] = await db.select({ storeId: storeDatabases.storeId }).from(storeDatabases).where(eq(storeDatabases.storeId, storeId)).limit(1);
  if (routed) return { ok: false, error: "بيانات هذا المتجر منقولة بالفعل إلى قاعدتكم." };

  const [open] = await db
    .select()
    .from(storeDbTransfers)
    .where(and(eq(storeDbTransfers.storeId, storeId), inArray(storeDbTransfers.status, ["queued", "copying", "syncing", "switching"])))
    .orderBy(desc(storeDbTransfers.createdAt))
    .limit(1);
  if (open && Date.now() - open.updatedAt.getTime() < STALE_MS) return { ok: true, jobId: open.id };
  if (open) await saveJob(open.id, { status: "failed", error: "استُبدلت بمحاولة جديدة.", targetUrlEnc: null });

  try {
    const { client } = connectExternal(checked.url);
    await client.query("select 1");
    const fit = await inspectTarget(client, storeId);
    if (!fit.ok) return fit;
  } catch (e) {
    log.warn("store", "transfer_connect_failed", { storeId }, safeError(e));
    return { ok: false, error: "تعذر الاتصال بقاعدة البيانات. تأكدوا من الرابط (يُنسخ من لوحة Neon مع كلمة المرور) ومن أن القاعدة تعمل." };
  }

  const [job] = await db
    .insert(storeDbTransfers)
    .values({ storeId, status: "queued", targetUrlEnc: await encryptSecret(checked.url), progress: { direction: "forward", pass: 1, tables: {} } })
    .returning({ id: storeDbTransfers.id });
  log.info("store", "transfer_started", { storeId, jobId: job!.id });
  return { ok: true, jobId: job!.id };
}

/** يرجع المتجر للمنصة (المدير فقط): يعكس النسخ ثم يحذف التوجيه. ممكن خلال مهلة نسخة المنصة. */
export async function startRollback(storeId: string): Promise<StartResult> {
  const [route] = await db.select().from(storeDatabases).where(eq(storeDatabases.storeId, storeId)).limit(1);
  if (!route) return { ok: false, error: "المتجر ليس منقولاً أصلاً." };
  if (route.platformPurgedAt || route.platformPurgeAt.getTime() < Date.now()) return { ok: false, error: "انتهت مهلة الرجوع: حُذفت نسخة المنصة." };
  const [job] = await db
    .insert(storeDbTransfers)
    .values({ storeId, status: "queued", targetUrlEnc: route.urlEnc, progress: { direction: "back", pass: 1, tables: {} } })
    .returning({ id: storeDbTransfers.id });
  log.info("store", "transfer_rollback_started", { storeId, jobId: job!.id });
  return { ok: true, jobId: job!.id };
}

async function setAccepting(storeId: string, value: boolean, external?: Conn) {
  await db.update(stores).set({ acceptingOrders: value }).where(eq(stores.id, storeId));
  const [s] = await db.select({ subdomain: stores.subdomain }).from(stores).where(eq(stores.id, storeId)).limit(1);
  if (s) await invalidateStoreCache({ id: storeId, subdomain: s.subdomain });
  if (external) await external.db.update(stores).set({ acceptingOrders: value }).where(eq(stores.id, storeId));
}

export type StepResult = { status: TransferStatus; percent: number; error: string | null };

/** ينفّذ جزءاً من العمل ضمن ميزانية زمنية ويعيد الحالة. آمن للاستدعاء المتكرر والمتزامن (قفل). */
export async function advanceTransfer(jobId: string): Promise<StepResult> {
  const lockKey = `transfer:lock:${jobId}`;
  const got = await redis.set(lockKey, "1", { nx: true, ex: 60 }).catch(() => "OK");
  const [job0] = await db.select().from(storeDbTransfers).where(eq(storeDbTransfers.id, jobId)).limit(1);
  if (!job0) return { status: "failed", percent: 0, error: "المهمة غير موجودة." };
  if (!got) return { status: job0.status as TransferStatus, percent: percent(jobProgress(job0)), error: job0.error };
  try {
    return await run(job0);
  } finally {
    await redis.del(lockKey).catch(() => {});
  }
}

async function run(job: Job): Promise<StepResult> {
  let status = job.status as TransferStatus;
  const prog = jobProgress(job);
  const out = (): StepResult => ({ status, percent: percent(prog), error: null });
  if (status === "done" || status === "failed" || !job.targetUrlEnc) return { status, percent: status === "done" ? 100 : percent(prog), error: job.error };

  const [store] = await db.select().from(stores).where(eq(stores.id, job.storeId)).limit(1);
  if (!store) return { status: "failed", percent: 0, error: "المتجر غير موجود." };
  const back = prog.direction === "back";
  const plan = planFor(prog.direction);
  const persist = async () => saveJob(job.id, { status, progress: prog as unknown as Record<string, unknown> });

  let external: ReturnType<typeof connectExternal> | null = null;
  try {
    external = connectExternal(await decryptSecret(job.targetUrlEnc));
    const source = back ? external.conn : platformConn;
    const target = back ? platformConn : external.conn;
    const ports = makePorts(source, target, store);

    if (status === "queued") {
      if (!back) await migrateTarget(external.client);
      const fresh = await prepareProgress(ports, plan, 1, prog);
      Object.assign(prog, fresh, { pass: 1 });
      status = "copying";
      await persist();
    }

    if (status === "copying") {
      const done = await copySteps(ports, plan, prog, { budgetMs: STEP_BUDGET_MS, onBatch: persist });
      if (!done) return out();
      // إيقاف قبول الطلبات لحظات لضمان مزامنة نهائية متسقة، ثم مزامنة كاملة (upsert) تلتقط ما تغيّر.
      prog.prevAccepting = store.acceptingOrders;
      await setAccepting(store.id, false);
      Object.assign(prog, await prepareProgress(ports, plan, 2, prog), { pass: 2 });
      status = "syncing";
      await persist();
    }

    if (status === "syncing") {
      const done = await copySteps(ports, plan, prog, { budgetMs: STEP_BUDGET_MS, onBatch: persist });
      if (!done) return out();
      const bad = await verifyCounts(ports, plan, prog);
      if (bad.length) {
        const first = bad[0]!;
        throw new Error(`عدم تطابق في «${first.table}»: ${first.source} في المصدر مقابل ${first.target} في الهدف. أعيدوا المحاولة.`);
      }
      status = "switching";
      await persist();
    }

    if (status === "switching") {
      const restore = prog.prevAccepting ?? true;
      if (back) {
        await db.delete(storeDatabases).where(eq(storeDatabases.storeId, store.id));
        await setAccepting(store.id, restore);
      } else {
        // الهدف يستقبل الطلبات بحالتها الأصلية قبل التحويل، ثم يُسجَّل التوجيه ذرياً في صف واحد.
        await external.conn.db.update(stores).set({ acceptingOrders: restore }).where(eq(stores.id, store.id));
        const urlEnc = job.targetUrlEnc;
        const purgeAt = new Date(Date.now() + PLATFORM_COPY_DAYS * 864e5);
        const hint = hostHint(new URL(await decryptSecret(urlEnc)).hostname);
        await db
          .insert(storeDatabases)
          .values({ storeId: store.id, urlEnc, hostHint: hint, platformPurgeAt: purgeAt })
          .onConflictDoUpdate({ target: storeDatabases.storeId, set: { urlEnc, hostHint: hint, switchedAt: new Date(), platformPurgeAt: purgeAt, platformPurgedAt: null } });
        await setAccepting(store.id, restore);
      }
      forgetTenantRoute(store.id);
      status = "done";
      await saveJob(job.id, { status, progress: prog as unknown as Record<string, unknown>, targetUrlEnc: null, error: null });
      log.info("store", back ? "transfer_rolled_back" : "transfer_done", { storeId: store.id, jobId: job.id });
    }
    return out();
  } catch (e) {
    const message = safeError(e);
    log.warn("store", "transfer_failed", { storeId: job.storeId, jobId: job.id }, message);
    // لا يبقى المتجر متوقف الطلبات بسبب فشل: تعاد حالته الأصلية.
    if (prog.prevAccepting !== undefined && status !== "switching") await setAccepting(job.storeId, prog.prevAccepting).catch(() => {});
    prog.resumeAt = status === "queued" ? "queued" : status === "copying" || status === "syncing" ? "copying" : status;
    await saveJob(job.id, { status: "failed", error: message, attempts: job.attempts + 1, progress: prog as unknown as Record<string, unknown> });
    return { status: "failed", percent: percent(prog), error: message };
  }
}

/** إعادة المحاولة بعد فشل: تستأنف من المرحلة المحفوظة (النسخ upsert فلا تكرار). */
export async function retryTransfer(jobId: string): Promise<StepResult> {
  const [job] = await db.select().from(storeDbTransfers).where(eq(storeDbTransfers.id, jobId)).limit(1);
  if (!job || job.status !== "failed" || !job.targetUrlEnc) return { status: (job?.status as TransferStatus) ?? "failed", percent: 0, error: job?.error ?? "لا يمكن إعادة هذه المحاولة. ابدأوا نقلاً جديداً." };
  if (!(await hit(`transfer:retry:${job.storeId}`, 10, 3600))) return { status: "failed", percent: 0, error: "محاولات كثيرة. حاولوا بعد ساعة." };
  const prog = jobProgress(job);
  await saveJob(job.id, { status: prog.resumeAt ?? "queued", error: null });
  return advanceTransfer(jobId);
}

export type TransferView = {
  state: "none" | "running" | "failed" | "done";
  jobId: string | null;
  status: TransferStatus | null;
  percent: number;
  label: string;
  error: string | null;
  direction: Direction;
  hostHint: string | null;
  switchedAt: Date | null;
  platformPurgeAt: Date | null;
  canRollback: boolean;
};

const LABELS: Record<TransferStatus, string> = {
  queued: "تجهيز الجداول في قاعدتكم",
  copying: "نسخ بيانات المتجر",
  syncing: "المزامنة النهائية ومطابقة الأعداد",
  switching: "تحويل المتجر إلى قاعدتكم",
  done: "اكتمل النقل",
  failed: "تعذر إكمال النقل",
};

export async function getTransferView(storeId: string): Promise<TransferView> {
  const [route] = await db.select().from(storeDatabases).where(eq(storeDatabases.storeId, storeId)).limit(1);
  const [job] = await db.select().from(storeDbTransfers).where(eq(storeDbTransfers.storeId, storeId)).orderBy(desc(storeDbTransfers.createdAt)).limit(1);
  const prog = job ? jobProgress(job) : null;
  const status = (job?.status as TransferStatus | undefined) ?? null;
  const runningJob = job && status !== "done" && status !== "failed";
  const state: TransferView["state"] = runningJob ? "running" : status === "failed" ? "failed" : route ? "done" : "none";
  return {
    state,
    jobId: job?.id ?? null,
    status,
    percent: prog ? percent(prog) : route ? 100 : 0,
    label: status ? LABELS[status] : route ? "بياناتكم في قاعدتكم الخاصة" : "",
    error: status === "failed" ? job?.error ?? null : null,
    direction: prog?.direction ?? "forward",
    hostHint: route?.hostHint ?? null,
    switchedAt: route?.switchedAt ?? null,
    platformPurgeAt: route && !route.platformPurgedAt ? route.platformPurgeAt : null,
    canRollback: !!route && !route.platformPurgedAt && route.platformPurgeAt.getTime() > Date.now(),
  };
}

/** يحذف نسخة المنصة بعد انتهاء المهلة (الصفوف فقط، لا الصور: الصور ما زالت مرجعاً للعميل). يستدعيه ops/sweep. */
export async function purgeExpiredPlatformCopies(limit = 5): Promise<number> {
  const due = await db
    .select()
    .from(storeDatabases)
    .where(and(isNull(storeDatabases.platformPurgedAt), lt(storeDatabases.platformPurgeAt, new Date())))
    .limit(limit);
  let n = 0;
  for (const r of due) {
    try {
      // البيانات الأصلية الآن عند العميل: نتحقق من أنها قابلة للقراءة قبل أن نحذف نسختنا.
      const { conn, client } = connectExternal(await decryptSecret(r.urlEnc));
      await client.query("select 1");
      void conn;
      for (const spec of [...PURGE_PLAN].reverse()) {
        const name = purgeTableName(spec.table);
        if (!specByName(name) || name === "store_blueprints" || name === "store_snapshots") continue;
        await db.delete(spec.table).where(spec.scope(r.storeId));
      }
      await db.update(storeDatabases).set({ platformPurgedAt: new Date() }).where(eq(storeDatabases.storeId, r.storeId));
      log.info("store", "platform_copy_purged", { storeId: r.storeId });
      n++;
    } catch (e) {
      log.warn("store", "platform_copy_purge_failed", { storeId: r.storeId }, safeError(e));
    }
  }
  return n;
}
