import "server-only";
// handlers.ts — معالجات مهام دورة حياة المتجر (التسليم، التجربة، الإيقاف، الحذف، الاستضافة، رفض الدفع). يستدعيها
// /api/jobs/lifecycle بعد التحقق من QStash، وscripts/dev/run-job.ts محلياً للتجربة.
import { and, count, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import { conversations, orders, platformPayments, products, stores } from "@/db/schema";
import { env } from "@/lib/env";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { deliverStore } from "@/ai/lifecycle/deliver";
import { recordEvent, transition } from "@/lifecycle/machine";
import { JOB_KINDS, claimJob, finishJob, schedule, type JobKind } from "@/lifecycle/scheduler";
import { deliverToMerchant } from "@/lifecycle/messenger";
import { currentPricing } from "@/server/pricing";
import { lifecycleTimings } from "@/lifecycle/timings";
import { purgeStore } from "@/server/ownership/transfer";
import { billingUrl, paymentVars, renderTemplate, type TemplateKey } from "@/lifecycle/templates";
import { POSTPONE_MS } from "@/lifecycle/config";
import { hostingState } from "@/lib/hosting";
import { invalidateStoreCache } from "@/lib/tenant";
import { clientEnv } from "@/lib/env";


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

/** تذكير قبل انتهاء سنة الاستضافة؛ يتخطى إن جُدِّد الاشتراك (تغيّر تاريخ الانتهاء) أو أوقف التاجر متجره. */
async function hostingReminder(s: Store, days: number) {
  const st = hostingState(s);
  if (st.phase !== "renew_soon") return { skip: st.phase };
  if (Math.abs(st.daysLeft - days) > 1) return { skip: "renewed_or_moved" };
  const { renewal } = await currentPricing();
  const when = days === 1 ? "غداً" : `بعد ${days === 7 ? "أسبوع" : "شهر"}`;
  return deliverToMerchant(s.id, {
    key: `hosting.reminder_${days}d:${s.id}:${st.expiresAt.getTime()}`,
    text: `تنبيه: سنة استضافة متجر ${s.name} تنتهي ${when} (${cairoDay(st.expiresAt)}). التجديد سنة كاملة بـ ${renewal} ج، ويُضاف لنهاية اشتراكك الحالي فلا تخسر أي يوم. متجرك وبياناتك كما هم دائماً.`,
    purpose: "transactional",
    buttons: [{ title: `جدّد الآن (${renewal} ج)`, url: billingUrl() }],
    email: { subject: `اشتراك متجرك ${s.name} ينتهي ${when}`, always: days <= 7 },
  });
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

/** سعر باقة هذا المتجر (المثبَّت عند التسليم) للرسائل. */
const storePrice = async (s: Store) => s.priceLockedEgp ?? (await currentPricing()).price;

/** أرقام حقيقية من متجره للرسائل (لا أرقام مخترعة): منتجاته المنشورة وطلباته التجريبية. */
async function storeNumbers(s: Store) {
  const tdb = await getTenantDb(s.id);
  const [p] = await tdb.select({ n: count() }).from(products).where(and(eq(products.storeId, s.id), eq(products.status, "active")));
  const [o] = await tdb.select({ n: count() }).from(orders).where(eq(orders.storeId, s.id));
  return { products: Number(p?.n ?? 0), orders: Number(o?.n ?? 0) };
}

export const HANDLERS: Record<JobKind, (s: Store) => Promise<unknown>> = {
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
      subject: `افتح متجرك ${s.name} لزباينك: ${await storePrice(s)} ج تشمل سنة استضافة`,
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
    const tip = n.orders === 0 ? "اعمل طلب تجريبي من متجرك كأنك زبون، وشوف إزاي الطلب بيوصلك في اللوحة وتطبع فاتورته." : `عملت ${n.orders} طلب تجريبي، ممتاز. جرّب كمان تغيّر حالة الطلب وتبعت للزبون رسالة واتساب جاهزة من صفحة الطلب.`;
    return deliverToMerchant(s.id, {
      key: `trial.reminder_6h:${s.id}`,
      text: `أفكار تستفيد بيها من متجر ${s.name} وأنت بتجربه (فيه ${n.products} منتج دلوقتي): ${tip} ولو عايز أي تعديل في الشكل أو المنتجات، رد علينا وفريقنا يعدّله.`,
      purpose: "promotional",
      email: { subject: `أفكار لتجربة متجرك ${s.name}` },
    });
  },

  "trial.reminder_20h": async (s) => {
    if (s.status !== "trial" || s.doomAt || (await hasPayment(s.id, ["under_review", "confirmed"])))
      return { skip: "not_applicable" };
    const price = await storePrice(s);
    const ends = s.trialEndsAt ? cairoDay(s.trialEndsAt) : "قريباً";
    return deliverToMerchant(s.id, {
      key: `trial.reminder_20h:${s.id}`,
      text: `تجربة متجر ${s.name} بتخلص ${ends}. عشان يفضل شغال لزباينك: الباقة ${price} جنيه وتشمل سنة استضافة وتشغيل كاملة، وبدون أي عمولة على مبيعاتك. ادفع وارفع الإيصال من هنا:`,
      purpose: "promotional",
      buttons: [{ title: `فعّل متجرك (${price} ج)`, url: activateUrl() }],
      email: { subject: `تجربة متجرك ${s.name} قربت تخلص` },
    });
  },

  "trial.freeze": async (s) => {
    if (s.status !== "trial") return { skip: s.status };
    if (s.doomAt) return { skip: "doom_controls" };
    if (await postponeIfReviewing(s, "trial.freeze")) return { postponed: true };
    const now = new Date();
    const t = await lifecycleTimings();
    const purgeAt = new Date(now.getTime() + (t.noticeHours + t.deleteHours) * 3_600_000);
    const r = await transition({
      storeId: s.id,
      to: "frozen",
      from: ["trial"],
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
    const price = await storePrice(s);
    const n = await storeNumbers(s);
    await deliverToMerchant(s.id, {
      key: `trial.freeze:${s.id}`,
      text: `انتهت تجربة متجر ${s.name} ووقّفناه مؤقتاً عن الزوار. كل حاجة محفوظة زي ما هي (${n.products} منتج، والتصميم، وإعداداتك) لحد ${cairoDay(purgeAt)}، وبعدها هيتحذف نهائياً. لو دفعت قبلها يرجع يشتغل فوراً بنفس الرابط: الباقة ${price} ج تشمل سنة استضافة كاملة.`,
      purpose: "transactional",
      buttons: [{ title: `فعّل متجرك (${price} ج)`, url: activateUrl() }],
      email: { subject: `انتهت تجربة متجرك ${s.name} وهو محفوظ لحد ${cairoDay(purgeAt)}`, always: true },
    });
    return { frozen: true };
  },

  "trial.last_chance": async (s) => {
    if (s.status !== "frozen" || s.doomAt) return { skip: "not_applicable" };
    if (await hasPayment(s.id, ["under_review", "confirmed"])) return { skip: "payment_exists" };
    const price = await storePrice(s);
    const when = s.purgeAt ? cairoDay(s.purgeAt) : "خلال ساعات";
    return deliverToMerchant(s.id, {
      key: `trial.last_chance:${s.id}`,
      text: `تنبيه أخير قبل حذف متجر ${s.name} نهائياً (${when}). بعد الحذف مش هنقدر نرجّع التصميم ولا المنتجات. لو حابب تحتفظ بيه، فعّله بالباقة (${price} ج تشمل سنة استضافة) من هنا:`,
      purpose: "transactional",
      buttons: [{ title: "فعّل متجرك قبل الحذف", url: activateUrl() }],
      email: { subject: `تنبيه أخير: متجرك ${s.name} هيتحذف ${when}`, always: true },
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

  // ── اشتراك الاستضافة (lib/hosting.ts): تذكيرات قبل الانتهاء، ثم السماح، ثم الإيقاف. لا حذف أبداً. ──
  "hosting.reminder_30d": (s) => hostingReminder(s, 30),
  "hosting.reminder_7d": (s) => hostingReminder(s, 7),
  "hosting.reminder_1d": (s) => hostingReminder(s, 1),

  "hosting.expired": async (s) => {
    const st = hostingState(s);
    if (st.phase !== "grace") return { skip: st.phase };
    await recordEvent({ storeId: s.id, storeRef: s.subdomain, type: "hosting.expired", actor: "timer" });
    const { renewal } = await currentPricing();
    return deliverToMerchant(s.id, {
      key: `hosting.expired:${s.id}:${st.expiresAt.getTime()}`,
      text: `انتهت سنة استضافة متجر ${s.name}. متجرك ما زال يعمل كالمعتاد حتى ${cairoDay(st.pauseAt)}، وبعدها يتوقف عن الظهور للزوار حتى تجدد. التجديد سنة كاملة بـ ${renewal} ج من صفحة الدفع، ولا يُحذف أي شيء من بياناتك.`,
      purpose: "transactional",
      buttons: [{ title: `جدّد الآن (${renewal} ج)`, url: billingUrl() }],
      email: { subject: `انتهت سنة استضافة متجرك ${s.name}`, always: true },
    });
  },

  "hosting.paused": async (s) => {
    const st = hostingState(s);
    if (st.phase !== "paused") return { skip: st.phase };
    await invalidateStoreCache(s).catch(() => {});
    await recordEvent({ storeId: s.id, storeRef: s.subdomain, type: "hosting.paused", actor: "timer" });
    await notifyAdmin(`توقف متجر ${s.subdomain} لانتهاء الاستضافة وفترة السماح (بياناته محفوظة)`, { storeId: s.id });
    const { renewal } = await currentPricing();
    return deliverToMerchant(s.id, {
      key: `hosting.paused:${s.id}:${st.expiresAt.getTime()}`,
      text: `توقف متجر ${s.name} مؤقتاً عن الظهور للزوار لانتهاء الاستضافة. لم يُحذف أي شيء: منتجاتك وطلباتك وعملاؤك وتصميمك محفوظون كما هم، وبمجرد التجديد (${renewal} ج للسنة) يعود متجرك فوراً بنفس الرابط.`,
      purpose: "transactional",
      buttons: [{ title: "جدّد وأعد متجرك", url: billingUrl() }],
      email: { subject: `متجرك ${s.name} متوقف مؤقتاً حتى التجديد`, always: true },
    });
  },

  "doom.reminder_12h": async (s) => {
    if (!s.doomAt || (s.status !== "trial" && s.status !== "frozen")) return { skip: "not_applicable" };
    if (await hasPayment(s.id, ["under_review"])) return { skip: "payment_under_review" };
    return sendTemplate(
      s,
      "doom.reminder_12h",
      { store: s.name, price: await storePrice(s), activate_url: activateUrl() },
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

