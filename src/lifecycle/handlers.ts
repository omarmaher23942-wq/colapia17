import "server-only";
// handlers.ts — معالجات مهام دورة حياة المتجر (التسليم، التجربة، الإيقاف، الحذف، الاستضافة، رفض الدفع). يستدعيها
// /api/jobs/lifecycle بعد التحقق من QStash، وscripts/dev/run-job.ts محلياً للتجربة.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, platformPayments, stores } from "@/db/schema";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { deliverStore } from "@/ai/lifecycle/deliver";
import { recordEvent, transition } from "@/lifecycle/machine";
import { schedule, type JobKind } from "@/lifecycle/scheduler";
import { deliverToMerchant } from "@/lifecycle/messenger";
import { currentProjectQuote } from "@/server/pricing";
import { lifecycleTimings } from "@/lifecycle/timings";
import { purgeStore } from "@/server/store-purge";
import { trialFacts } from "@/server/repos/trial-facts";
import { billingUrl, paymentVars, renderTemplate, type TemplateKey } from "@/lifecycle/templates";
import { POSTPONE_MS } from "@/lifecycle/config";
import { invalidateStoreCache } from "@/lib/tenant";
import { setupHandlers } from "@/agent/setup-jobs";


type Store = typeof stores.$inferSelect;
type Stage = (typeof conversations.$inferSelect)["stage"];


// كل دعوة للدفع تشير لصفحة الدفع على المنصة (لا تحتاج المتجر).
const activateUrl = () => billingUrl();
const cairoDay = (d: Date) => new Intl.DateTimeFormat("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Cairo" }).format(d);
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

/** سعر التفعيل الآن (الدائرة الذهبية متى بقي مقعد وإلا العادي). */
const buildPrice = async () => (await currentProjectQuote()).price.toLocaleString("en-US");
const storePrice = buildPrice;
const storeNumbers = (s: Store) => trialFacts(s);

/** سطر ما حدث في المتجر خلال التجربة (يُذكر فقط ما حدث فعلاً). */
function trialFactsLine(n: { realOrders: number; visitors: number }): string {
  const parts = [n.visitors > 0 ? `زاره ${n.visitors} زائر` : "", n.realOrders > 0 ? `ووصله ${n.realOrders} طلب حقيقي` : ""].filter(Boolean);
  return parts.length ? ` خلال التجربة ${parts.join(" ")}.` : "";
}

export const HANDLERS: Record<JobKind, (s: Store) => Promise<unknown>> = {
  ...setupHandlers,
  "delivery.auto": async (s) => {
    if (s.status === "review" || s.status === "building") return { delivered: await deliverStore(s.id, "auto") };
    return { skip: s.status };
  },

  // البناء الآلي القديم (مراجعة 12 ساعة ثم بناء بالذكاء الاصطناعي) أُزيل في المرحلة 8: الفريق يبني من لوحة الإنتاج.
  // تبقى المهام المجدولة قبل الإزالة تُتجاهل بأمان.
  "review.auto_release": async (s) => ({ skip: `retired:${s.status}` }),
  "review.reminder": async (s) => ({ skip: `retired:${s.status}` }),

  "payment.invite": async (s) => {
    if (s.status !== "trial" || s.paymentInvitedAt || s.doomAt) return { skip: "not_applicable" };
    if (await hasPayment(s.id, ["under_review", "confirmed"])) return { skip: "payment_exists" };
    const report = await sendTemplate(s, "payment.invite", await paymentVars(s, activateUrl()), {
      purpose: "promotional",
      subject: `افتحوا متجر ${s.name} لزبائنكم: التفعيل ${await storePrice()} ج`,
    });
    if (report.viaMeta || report.emailed) {
      await db.update(stores).set({ paymentInvitedAt: new Date(), updatedAt: new Date() }).where(eq(stores.id, s.id));
      await recordEvent({ storeId: s.id, storeRef: s.subdomain, type: "payment.invited", data: { ...report } });
    }
    return report;
  },

  // ── التجربة بعد التسليم (المدد من lifecycle/timings.ts): أفكار ← تذكير الدفع ← إيقاف ← تنبيه أخير ← حذف ──
  "trial.reminder_6h": async (s) => {
    if (s.status !== "trial" || s.doomAt || (await hasPayment(s.id, ["under_review", "confirmed"])))
      return { skip: "not_applicable" };
    const n = await storeNumbers(s);
    const tip =
      n.orders === 0
        ? "اطلبوا منتجاً من المتجر كما يفعل زبائنكم: يظهر الطلب في اللوحة «تجريبياً» فلا يخصم من المخزون، ومنه تطبعون الفاتورة."
        : `وصلكم ${n.orders} طلب تجريبي، ممتاز. الخطوة التالية: غيّروا حالة الطلب وجرّبوا رسالة واتساب الجاهزة من صفحة الطلب.`;
    const { text } = await renderTemplate("trial.ideas", { store: s.name, products: n.products, tip, facts_line: trialFactsLine(n) });
    return deliverToMerchant(s.id, {
      key: `trial.reminder_6h:${s.id}`,
      text,
      purpose: "promotional",
      email: { subject: `أفكار لتجربة متجركم ${s.name}` },
    });
  },

  "trial.reminder_20h": async (s) => {
    if (s.status !== "trial" || s.doomAt || (await hasPayment(s.id, ["under_review", "confirmed"])))
      return { skip: "not_applicable" };
    const ends = s.trialEndsAt ? cairoDay(s.trialEndsAt) : "قريباً";
    const n = await storeNumbers(s);
    const pv = await paymentVars(s, activateUrl());
    const { text } = await renderTemplate("trial.pay", { store: s.name, ends, facts_line: trialFactsLine(n), price: pv.price, plans: pv.plans, build: pv.build });
    return deliverToMerchant(s.id, {
      key: `trial.reminder_20h:${s.id}`,
      text,
      purpose: "promotional",
      buttons: [{ title: "تفعيل المتجر", url: activateUrl() }],
      email: { subject: `تجربة متجركم ${s.name} تقترب من نهايتها` },
    });
  },

  "trial.freeze": async (s) => {
    // «setup» أيضاً: العدّاد يبدأ عند أول فتح لرابط الإعداد، فقد تنتهي المهلة قبل أن يكمل التاجر الإعداد.
    if (s.status !== "trial" && s.status !== "setup") return { skip: s.status };
    if (s.doomAt) return { skip: "doom_controls" };
    if (await postponeIfReviewing(s, "trial.freeze")) return { postponed: true };
    const now = new Date();
    const t = await lifecycleTimings();
    const purgeAt = new Date(now.getTime() + (t.noticeHours + t.deleteHours) * 3_600_000);
    const r = await transition({
      storeId: s.id,
      to: "frozen",
      from: ["trial", "setup"],
      actor: "timer",
      set: { frozenAt: now, purgeAt },
      reason: "trial_ended",
    });
    if (!r.ok) return { skip: r.reason };
    // موعد الحذف المعلن للعميل يطابق المهام المجدولة فعلاً (قد تختلف المدد عن وقت التسليم إن غيّرها المالك).
    await schedule(s.id, "trial.last_chance", new Date(now.getTime() + t.noticeHours * 3_600_000));
    await schedule(s.id, "trial.purge", purgeAt);
    await invalidateStoreCache(s).catch(() => {});
    await setStage(s.id, "frozen");
    const price = await storePrice();
    const n = await storeNumbers(s);
    const { text } = await renderTemplate("trial.freeze", { store: s.name, facts_line: trialFactsLine(n), products: n.products, purge_day: cairoDay(purgeAt), price, build: await buildPrice() });
    await deliverToMerchant(s.id, {
      key: `trial.freeze:${s.id}`,
      text,
      purpose: "transactional",
      buttons: [{ title: "تفعيل المتجر", url: activateUrl() }],
      email: { subject: `انتهت معاينة متجركم ${s.name} وهو محفوظ حتى ${cairoDay(purgeAt)}`, always: true },
    });
    return { frozen: true };
  },

  "trial.last_chance": async (s) => {
    if (s.status !== "frozen" || s.doomAt) return { skip: "not_applicable" };
    if (await hasPayment(s.id, ["under_review", "confirmed"])) return { skip: "payment_exists" };
    const price = await storePrice();
    const when = s.purgeAt ? cairoDay(s.purgeAt) : "خلال ساعات";
    const { text } = await renderTemplate("trial.last_chance", { store: s.name, when, build: price });
    return deliverToMerchant(s.id, {
      key: `trial.last_chance:${s.id}`,
      text,
      purpose: "transactional",
      buttons: [{ title: "تفعيل المتجر قبل الحذف", url: activateUrl() }],
      email: { subject: `تنبيه أخير: متجركم ${s.name} سيُحذف ${when}`, always: true },
    });
  },

  "trial.purge": async (s) => {
    if (s.status !== "frozen" || s.doomAt) return { skip: "not_applicable" };
    if (s.purgeAt && s.purgeAt.getTime() > Date.now() + 2 * 60_000) return { skip: "timer_moved" };
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
    // حذف كامل لبيانات المتجر وصوره (صف المتجر والتاجر يبقيان للسجل والدفع)، والنطاق يعرض 404.
    const purged = await purgeStore(s);
    if (!purged) throw new Error("purge failed");
    await invalidateStoreCache(s).catch(() => {});
    await setStage(s.id, "lost");
    await sendTemplate(s, "doom.deleted", { store: s.name }, { purpose: "transactional", subject: `تم حذف متجر ${s.name}` }).catch(() => {});
    await notifyAdmin(`حُذف متجر ${s.subdomain} وبياناته وصوره بعد انتهاء التجربة والتنبيه الأخير`, { storeId: s.id });
    return { deleted: true };
  },

  "doom.reminder_12h": async (s) => {
    if (!s.doomAt || (s.status !== "trial" && s.status !== "frozen")) return { skip: "not_applicable" };
    if (await hasPayment(s.id, ["under_review"])) return { skip: "payment_under_review" };
    return sendTemplate(
      s,
      "doom.reminder_12h",
      { store: s.name, build: await buildPrice(), activate_url: activateUrl() },
      { purpose: "transactional", subject: `تبقّت 12 ساعة على حذف متجر ${s.name}` }
    );
  },

  "doom.reminder_1h": async (s) => {
    if (!s.doomAt || (s.status !== "trial" && s.status !== "frozen")) return { skip: "not_applicable" };
    if (await hasPayment(s.id, ["under_review"])) return { skip: "payment_under_review" };
    return sendTemplate(
      s,
      "doom.reminder_1h",
      { store: s.name, activate_url: activateUrl() },
      { purpose: "transactional", subject: `تبقّت ساعة واحدة على حذف متجر ${s.name}`, always: true }
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
    // حذف كامل لبيانات المتجر وصوره (كما في trial.purge)، لا تغيير حالة فقط.
    const purged = await purgeStore(s);
    if (!purged) throw new Error("purge failed");
    await invalidateStoreCache(s).catch(() => {});
    await db
      .update(conversations)
      .set({ stage: "lost", lostReason: "doom_unpaid", updatedAt: new Date() })
      .where(eq(conversations.storeId, s.id));
    await sendTemplate(s, "doom.deleted", { store: s.name }, { purpose: "transactional", subject: `تم حذف متجر ${s.name}` });
    await notifyAdmin(`تم مسح متجر ${s.subdomain} نهائياً بعد انتهاء مهلة الدفع`, { storeId: s.id });
    return { deleted: true };
  },
};

