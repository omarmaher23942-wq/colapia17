import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { UTApi } from "uploadthing/server";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import { conversations, platformPayments, products, storeTransfers, stores } from "@/db/schema";
import { env } from "@/lib/env";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { deliverStore } from "@/ai/lifecycle/deliver";
import { recordEvent, transition } from "@/lifecycle/machine";
import { JOB_KINDS, claimJob, finishJob, schedule, type JobKind } from "@/lifecycle/scheduler";
import { deliverToMerchant } from "@/lifecycle/messenger";
import { platformPricing } from "@/lib/platform-pricing";
import { billingUrl, paymentVars, renderTemplate, type TemplateKey } from "@/lifecycle/templates";
import { releaseToBuild } from "@/lifecycle/release";
import { POSTPONE_MS } from "@/lifecycle/config";
import { ownWindow } from "@/lib/ownership-window";
import { purgeStore } from "@/server/ownership/transfer";
import { invalidateStoreCache } from "@/lib/tenant";
import { clientEnv } from "@/lib/env";

export const maxDuration = 60;

type Store = typeof stores.$inferSelect;
type Stage = (typeof conversations.$inferSelect)["stage"];

const bodySchema = z.object({
  storeId: z.string().uuid(),
  kind: z.enum(JOB_KINDS),
  jobId: z.string().uuid().optional(),
});

// كل دعوة للدفع تشير لصفحة الدفع على المنصة (لا تحتاج المتجر).
const activateUrl = () => billingUrl();
const ownUrl = () => `${clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/dashboard/own`;
const cairo = (d: Date) => new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Africa/Cairo" }).format(d);
const setStage = (storeId: string, stage: Stage) =>
  db.update(conversations).set({ stage, updatedAt: new Date() }).where(eq(conversations.storeId, storeId));

async function hasPayment(storeId: string, statuses: ("under_review" | "confirmed")[]) {
  const [r] = await db
    .select({ id: platformPayments.id })
    .from(platformPayments)
    .where(and(eq(platformPayments.storeId, storeId), inArray(platformPayments.status, statuses)))
    .limit(1);
  return !!r;
}

async function postponeIfReviewing(s: Store, kind: JobKind): Promise<boolean> {
  if (!(await hasPayment(s.id, ["under_review"]))) return false;
  await schedule(s.id, kind, new Date(Date.now() + POSTPONE_MS));
  await recordEvent({
    storeId: s.id,
    storeRef: s.subdomain,
    type: "job.postponed",
    data: { kind, reason: "payment_under_review" },
  });
  return true;
}

async function sendTemplate(
  s: Store,
  key: TemplateKey,
  vars: Record<string, string | number | undefined>,
  o: { purpose: "transactional" | "promotional"; subject: string; always?: boolean }
) {
  const { text } = await renderTemplate(key, vars);
  return deliverToMerchant(s.id, {
    key: `${key}:${s.id}`,
    text,
    purpose: o.purpose,
    email: { subject: o.subject, always: o.always },
  });
}

const GRACE_MSG = () =>
  `انتهت فترة التجربة المجانية لمتجرك، ومتجرك محفوظ ليك بالكامل لمدة ${env.GRACE_DAYS} أيام. تقدر تفعّله للأبد بـ ${platformPricing().price} ج في أي وقت من نفس الرابط بدون أي اشتراكات وبدون أي عمولة.`;

const HANDLERS: Record<JobKind, (s: Store) => Promise<unknown>> = {
  "delivery.auto": async (s) => {
    if (s.status === "review" || s.status === "building") return { delivered: await deliverStore(s.id, "auto") };
    return { skip: s.status };
  },

  "review.auto_release": async (s) => {
    if (s.status !== "pending_review") return { skip: s.status };
    if (!s.reviewDeadlineAt || s.reviewDeadlineAt.getTime() > Date.now() + 2 * 60_000) return { skip: "timer_moved" };
    const r = await releaseToBuild(s.id, "timer");
    if (!r.started && r.reason === "start_failed") throw new Error("build start failed");
    return r;
  },

  "review.reminder": async (s) => {
    if (s.status !== "pending_review" || !s.reviewDeadlineAt) return { skip: s.status };
    await notifyAdmin(`باقي ساعة على الإرسال التلقائي لبناء متجر: ${s.subdomain}`, { storeId: s.id });
    return { reminded: true };
  },

  "payment.invite": async (s) => {
    if (s.status !== "trial" || s.paymentInvitedAt || s.doomAt) return { skip: "not_applicable" };
    if (await hasPayment(s.id, ["under_review", "confirmed"])) return { skip: "payment_exists" };
    const report = await sendTemplate(s, "payment.invite", paymentVars(s.name, activateUrl()), {
      purpose: "promotional",
      subject: `فعّل متجرك ${s.name} للأبد بـ ${platformPricing().price} ج`,
    });
    if (report.viaMeta || report.emailed) {
      await db.update(stores).set({ paymentInvitedAt: new Date(), updatedAt: new Date() }).where(eq(stores.id, s.id));
      await recordEvent({ storeId: s.id, storeRef: s.subdomain, type: "payment.invited", data: { ...report } });
    }
    return report;
  },

  "trial.reminder_6h": async (s) => {
    if (s.status !== "trial" || s.doomAt || (await hasPayment(s.id, ["under_review", "confirmed"])))
      return { skip: "not_applicable" };
    return deliverToMerchant(s.id, {
      key: `trial.reminder_6h:${s.id}`,
      text: "عجبك المتجر ولوحة التحكم؟ لو محتاج أي مساعدة أو تعديل قولي وإحنا معاك خطوة بخطوة.",
      purpose: "promotional",
    });
  },

  "trial.reminder_20h": async (s) => {
    if (s.status !== "trial" || s.doomAt || (await hasPayment(s.id, ["under_review", "confirmed"])))
      return { skip: "not_applicable" };
    return deliverToMerchant(s.id, {
      key: `trial.reminder_20h:${s.id}`,
      text: `باقي ساعات قليلة على انتهاء فترة التجربة. لو حابب تمتلك متجرك للأبد بـ ${platformPricing().price} جنيه دفعة واحدة وبدون اشتراكات، تقدر تفعّله الآن:`,
      purpose: "promotional",
      buttons: [{ title: "امتلك متجرك الآن", url: activateUrl() }],
      email: { subject: `باقي ساعات على انتهاء تجربة متجر ${s.name}` },
    });
  },

  "trial.freeze": async (s) => {
    if (s.status !== "trial") return { skip: s.status };
    if (s.doomAt) return { skip: "doom_controls" };
    if (await postponeIfReviewing(s, "trial.freeze")) return { postponed: true };
    const now = new Date();
    const r = await transition({
      storeId: s.id,
      to: "frozen",
      from: ["trial"],
      actor: "timer",
      set: { frozenAt: now, purgeAt: new Date(now.getTime() + env.GRACE_DAYS * 864e5) },
      reason: "trial_ended",
    });
    if (!r.ok) return { skip: r.reason };
    await setStage(s.id, "frozen");
    await deliverToMerchant(s.id, {
      key: `trial.freeze:${s.id}`,
      text: GRACE_MSG(),
      purpose: "transactional",
      buttons: [{ title: `تفعيل المتجر (${platformPricing().price} ج)`, url: activateUrl() }],
      email: { subject: `انتهت تجربة متجر ${s.name} والمتجر محفوظ ليك` },
    });
    return { frozen: true };
  },

  "trial.last_chance": async (s) => {
    if (s.status !== "frozen" || s.doomAt) return { skip: "not_applicable" };
    if (await hasPayment(s.id, ["under_review", "confirmed"])) return { skip: "payment_exists" };
    return deliverToMerchant(s.id, {
      key: `trial.last_chance:${s.id}`,
      text: `فاضل أيام قليلة قبل حذف متجر ${s.name} نهائياً. لو حابب تحتفظ بيه وشغال مدى الحياة، فعّله بـ ${platformPricing().price} ج من هنا:`,
      purpose: "transactional",
      buttons: [{ title: "تفعيل المتجر الآن", url: activateUrl() }],
      email: { subject: `متجرك ${s.name} على وشك الحذف`, always: true },
    });
  },

  "trial.purge": async (s) => {
    if (s.status !== "frozen" || s.doomAt) return { skip: "not_applicable" };
    if (await postponeIfReviewing(s, "trial.purge")) return { postponed: true };
    const r = await transition({
      storeId: s.id,
      to: "deleted",
      from: ["frozen"],
      actor: "timer",
      set: { deletedAt: new Date() },
      reason: "grace_ended",
    });
    if (!r.ok) return { skip: r.reason };
    const ut = new UTApi();
    const rows = await (await getTenantDb(s.id))
      .select({ images: products.images })
      .from(products)
      .where(eq(products.storeId, s.id));
    const keys = rows.flatMap((p) => p.images.map((i) => i.key).filter((k): k is string => !!k));
    if (keys.length) await ut.deleteFiles(keys).catch(() => {});
    await setStage(s.id, "lost");
    await notifyAdmin(`تم حذف متجر ${s.subdomain} ومسح ملفاته بعد انتهاء فترة السماح`, { storeId: s.id });
    return { deleted: true, files: keys.length };
  },

  // ── مهلة نقل المتجر المدفوع (lib/ownership-window.ts) ──
  "own.reminder_24h": async (s) => {
    const w = ownWindow(s);
    if (w.phase !== "open") return { skip: w.phase };
    return deliverToMerchant(s.id, {
      key: `own.reminder_24h:${s.id}`,
      text: `باقي يوم على مهلة نقل متجر ${s.name} لحساباتك (حتى ${cairo(w.deadline)}). النقل بخطوات مشروحة ويأخذ نحو نصف ساعة، وبعد المهلة يتوقف المتجر عن استقبال الطلبات حتى تكمله.`,
      purpose: "transactional",
      buttons: [{ title: "انقل متجرك الآن", url: ownUrl() }],
      email: { subject: `باقي يوم لنقل متجرك ${s.name}`, always: true },
    });
  },

  "own.deadline": async (s) => {
    const w = ownWindow(s);
    if (w.phase !== "overdue") return { skip: w.phase };
    await invalidateStoreCache(s).catch(() => {});
    await recordEvent({ storeId: s.id, storeRef: s.subdomain, type: "own.deadline", actor: "timer" });
    return deliverToMerchant(s.id, {
      key: `own.deadline:${s.id}`,
      text: `انتهت مهلة نقل متجر ${s.name}، فتوقف عن استقبال الطلبات. بياناتك كلها محفوظة: أكمل النقل الآن ويعمل متجرك على موقعك فوراً. إن لم يكتمل النقل حتى ${cairo(w.purgeAt)} تُحذف بيانات المتجر من Colapia.`,
      purpose: "transactional",
      buttons: [{ title: "أكمل النقل", url: ownUrl() }],
      email: { subject: `متجرك ${s.name} متوقف حتى تكمل نقله`, always: true },
    });
  },

  "own.purge_warning": async (s) => {
    const w = ownWindow(s);
    if (w.phase !== "overdue") return { skip: w.phase };
    return deliverToMerchant(s.id, {
      key: `own.purge_warning:${s.id}`,
      text: `تنبيه أخير: بيانات متجر ${s.name} (المنتجات والطلبات والعملاء) تُحذف من Colapia ${cairo(w.purgeAt)} لأن نقلها لحساباتك لم يكتمل. أكمل النقل الآن لتحتفظ بها.`,
      purpose: "transactional",
      buttons: [{ title: "أكمل النقل الآن", url: ownUrl() }],
      email: { subject: `تنبيه أخير: بيانات متجرك ${s.name} تُحذف قريباً`, always: true },
    });
  },

  "own.purge": async (s) => {
    const w = ownWindow(s);
    if (w.phase !== "overdue") return { skip: w.phase };
    if (w.purgeAt.getTime() > Date.now() + 2 * 60_000) return { skip: "purge_moved" };
    // استلام جارٍ الآن: لا نحذف تحت قدميه؛ نعيد المحاولة بعد ساعة.
    const [busy] = await db
      .select({ id: storeTransfers.id })
      .from(storeTransfers)
      .where(and(eq(storeTransfers.storeId, s.id), eq(storeTransfers.status, "importing")))
      .limit(1);
    if (busy) {
      await schedule(s.id, "own.purge", new Date(Date.now() + POSTPONE_MS));
      return { postponed: "importing" };
    }
    const r = await transition({ storeId: s.id, to: "deleted", from: ["active"], actor: "timer", set: { deletedAt: new Date() }, reason: "not_owned_in_time" });
    if (!r.ok) return { skip: r.reason };
    const purged = await purgeStore(s);
    await notifyAdmin(`حُذفت بيانات متجر ${s.subdomain} (مدفوع) لأن صاحبه لم ينقله خلال المهلة`, { storeId: s.id });
    return { deleted: true, purged };
  },

  "doom.reminder_12h": async (s) => {
    if (!s.doomAt || (s.status !== "trial" && s.status !== "frozen")) return { skip: "not_applicable" };
    if (await hasPayment(s.id, ["under_review"])) return { skip: "payment_under_review" };
    return sendTemplate(
      s,
      "doom.reminder_12h",
      { store: s.name, price: platformPricing().price, activate_url: activateUrl() },
      { purpose: "transactional", subject: `باقي 12 ساعة على مسح متجر ${s.name}` }
    );
  },

  "doom.reminder_1h": async (s) => {
    if (!s.doomAt || (s.status !== "trial" && s.status !== "frozen")) return { skip: "not_applicable" };
    if (await hasPayment(s.id, ["under_review"])) return { skip: "payment_under_review" };
    return sendTemplate(
      s,
      "doom.reminder_1h",
      { store: s.name, activate_url: activateUrl() },
      { purpose: "transactional", subject: `باقي ساعة واحدة على مسح متجر ${s.name}`, always: true }
    );
  },

  "doom.purge": async (s) => {
    if (!s.doomAt || (s.status !== "trial" && s.status !== "frozen")) return { skip: "not_applicable" };
    if (s.doomAt.getTime() > Date.now() + 2 * 60_000) return { skip: "doom_moved" };
    if (await postponeIfReviewing(s, "doom.purge")) return { postponed: true };
    const r = await transition({
      storeId: s.id,
      to: "deleted",
      from: ["trial", "frozen"],
      actor: "timer",
      set: { deletedAt: new Date() },
      reason: "doom_unpaid",
    });
    if (!r.ok) return { skip: r.reason };
    await db
      .update(conversations)
      .set({ stage: "lost", lostReason: "doom_unpaid", updatedAt: new Date() })
      .where(eq(conversations.storeId, s.id));
    await sendTemplate(s, "doom.deleted", { store: s.name }, { purpose: "transactional", subject: `تم مسح متجر ${s.name}` });
    await notifyAdmin(`تم مسح متجر ${s.subdomain} نهائياً بعد انتهاء مهلة الدفع`, { storeId: s.id });
    return { deleted: true };
  },
};

export const POST = verifySignatureAppRouter(async (req: Request) => {
  if (req.headers.get("x-internal") !== env.QSTASH_INTERNAL_SECRET) return new Response("forbidden", { status: 403 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ skip: "bad_body" });
  const { storeId, kind, jobId } = parsed.data;

  const job = await claimJob({ jobId, storeId, kind });
  if (!job) return NextResponse.json({ skip: "not_claimable" });

  try {
    const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
    const result = store ? await HANDLERS[kind](store) : { skip: "store_not_found" };
    await finishJob(job.id, true);
    return NextResponse.json({ ok: true, kind, result });
  } catch (e) {
    console.error("[jobs/lifecycle] handler failed", kind, storeId, e);
    await finishJob(job.id, false, e);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }
});