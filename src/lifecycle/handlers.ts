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
import { currentPricing } from "@/server/pricing";
import { hostingGraceDays, lifecycleTimings } from "@/lifecycle/timings";
import { startingPrice } from "@/lib/platform-pricing";
import { purgeStore } from "@/server/ownership/transfer";
import { trialFacts } from "@/server/repos/trial-facts";
import { billingUrl, paymentVars, renderTemplate, type TemplateKey } from "@/lifecycle/templates";
import { POSTPONE_MS } from "@/lifecycle/config";
import { hostingState } from "@/lib/hosting";
import { invalidateStoreCache } from "@/lib/tenant";


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
  const st = await hosting(s);
  if (st.phase !== "renew_soon") return { skip: st.phase };
  if (Math.abs(st.daysLeft - days) > 1) return { skip: "renewed_or_moved" };
  const renewal = await renewalFrom();
  const when = days === 1 ? "غداً" : `بعد ${days === 7 ? "أسبوع" : "شهر"}`;
  return deliverToMerchant(s.id, {
    key: `hosting.reminder_${days}d:${s.id}:${st.expiresAt.getTime()}`,
    text: `تنبيه: اشتراك متجر ${s.name} ينتهي ${when} (${cairoDay(st.expiresAt)}). يمكنكم التجديد بالمدة التي تناسبكم (يبدأ من ${renewal})، وتُضاف المدة إلى نهاية الاشتراك الحالي فلا يضيع أي يوم. المتجر وبياناته كما هي دائماً.`,
    purpose: "transactional",
    buttons: [{ title: "التجديد الآن", url: billingUrl() }],
    email: { subject: `اشتراك متجركم ${s.name} ينتهي ${when}`, always: days <= 7 },
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

/** أرخص باقة الآن (للرسائل: «الباقات تبدأ من …»). */
const storePrice = async (_s: Store) => startingPrice(await currentPricing()).toLocaleString("en-US");
/** أرخص تجديد الآن ومدته (للتذكيرات). */
async function renewalFrom(): Promise<string> {
  const p = await currentPricing();
  const cheapest = [...p.plans].sort((a, b) => a.renewal - b.renewal)[0]!;
  return `${cheapest.renewal.toLocaleString("en-US")} ج لـ ${cheapest.months} أشهر`;
}
const hosting = async (s: Store) => hostingState(s, new Date(), undefined, await hostingGraceDays().catch(() => undefined));

const storeNumbers = (s: Store) => trialFacts(s);

/** سطر ما حدث في المتجر خلال التجربة (يُذكر فقط ما حدث فعلاً). */
function trialFactsLine(n: { realOrders: number; visitors: number }): string {
  const parts = [n.visitors > 0 ? `زاره ${n.visitors} زائر` : "", n.realOrders > 0 ? `ووصله ${n.realOrders} طلب حقيقي` : ""].filter(Boolean);
  return parts.length ? ` خلال التجربة ${parts.join(" ")}.` : "";
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
      subject: `افتحوا متجر ${s.name} لعملائكم: الباقات تبدأ من ${await storePrice(s)} ج`,
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
        ? "اطلبوا منتج من المتجر كأنكم عملاء: الطلب يظهر في اللوحة «تجريبي» (لا يخصم من المخزون)، ومنه تطبعوا الفاتورة."
        : `اتعمل ${n.orders} طلب تجريبي، ممتاز. الخطوة الجاية: تغيير حالة الطلب، وتجربة رسالة واتساب الجاهزة للعميل من صفحة الطلب.`;
    return deliverToMerchant(s.id, {
      key: `trial.reminder_6h:${s.id}`,
      text: `أفكار لتجربة متجر ${s.name} (فيه ${n.products} منتج دلوقتي): ${tip}${trialFactsLine(n)} ولو في أي تعديل في الشكل أو المنتجات، ردّوا علينا وفريقنا يعدّله.`,
      purpose: "promotional",
      email: { subject: `أفكار لتجربة متجرك ${s.name}` },
    });
  },

  "trial.reminder_20h": async (s) => {
    if (s.status !== "trial" || s.doomAt || (await hasPayment(s.id, ["under_review", "confirmed"])))
      return { skip: "not_applicable" };
    const price = await storePrice(s);
    const ends = s.trialEndsAt ? cairoDay(s.trialEndsAt) : "قريباً";
    const n = await storeNumbers(s);
    return deliverToMerchant(s.id, {
      key: `trial.reminder_20h:${s.id}`,
      text: `تنتهي تجربة متجر ${s.name} ${ends}.${trialFactsLine(n)} ليبقى متاحاً لعملائكم بنفس الرابط، اختاروا باقة 3 أو 6 أشهر أو سنة (تبدأ من ${price} ج شاملة البناء والاستضافة والتشغيل، بلا أي عمولة على المبيعات). التحويل ورفع الإيصال من هنا:`,
      purpose: "promotional",
      buttons: [{ title: "تفعيل المتجر", url: activateUrl() }],
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
      text: `انتهت تجربة متجر ${s.name} ووقّفناه مؤقتاً عن الزوار.${trialFactsLine(n)} كل حاجة محفوظة زي ما هي (${n.products} منتج، والتصميم، والإعدادات) لحد ${cairoDay(purgeAt)}، وبعدها هيتحذف نهائياً. إن تم الدفع قبلها يعود فوراً بنفس الرابط، والباقات تبدأ من ${price} ج شاملة البناء والاستضافة.`,
      purpose: "transactional",
      buttons: [{ title: "تفعيل المتجر", url: activateUrl() }],
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
      text: `تنبيه أخير قبل حذف متجر ${s.name} نهائياً (${when}). بعد الحذف مش هنقدر نرجّع التصميم ولا المنتجات. للاحتفاظ به: التفعيل بأي باقة (تبدأ من ${price} ج) من هنا:`,
      purpose: "transactional",
      buttons: [{ title: "تفعيل المتجر قبل الحذف", url: activateUrl() }],
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
    const st = await hosting(s);
    if (st.phase !== "grace") return { skip: st.phase };
    await recordEvent({ storeId: s.id, storeRef: s.subdomain, type: "hosting.expired", actor: "timer" });
    const renewal = await renewalFrom();
    return deliverToMerchant(s.id, {
      key: `hosting.expired:${s.id}:${st.expiresAt.getTime()}`,
      text: `انتهى اشتراك متجر ${s.name}. المتجر ما زال يعمل كالمعتاد حتى ${cairoDay(st.pauseAt)}، ثم يتوقف عن الظهور للزوار حتى التجديد. التجديد من صفحة الدفع بالمدة التي تناسبكم (يبدأ من ${renewal})، ولا يُحذف أي شيء من بياناتكم.`,
      purpose: "transactional",
      buttons: [{ title: "التجديد الآن", url: billingUrl() }],
      email: { subject: `انتهى اشتراك متجركم ${s.name}`, always: true },
    });
  },

  "hosting.paused": async (s) => {
    const st = await hosting(s);
    if (st.phase !== "paused") return { skip: st.phase };
    await invalidateStoreCache(s).catch(() => {});
    await recordEvent({ storeId: s.id, storeRef: s.subdomain, type: "hosting.paused", actor: "timer" });
    await notifyAdmin(`توقف متجر ${s.subdomain} لانتهاء الاستضافة وفترة السماح (بياناته محفوظة)`, { storeId: s.id });
    const renewal = await renewalFrom();
    return deliverToMerchant(s.id, {
      key: `hosting.paused:${s.id}:${st.expiresAt.getTime()}`,
      text: `توقف متجر ${s.name} مؤقتاً عن الظهور للزوار لانتهاء الاشتراك. لم يُحذف أي شيء: المنتجات والطلبات والعملاء والتصميم محفوظة كما هي، وبمجرد التجديد (يبدأ من ${renewal}) يعود المتجر فوراً بنفس الرابط.`,
      purpose: "transactional",
      buttons: [{ title: "التجديد وإعادة المتجر", url: billingUrl() }],
      email: { subject: `متجركم ${s.name} متوقف مؤقتاً حتى التجديد`, always: true },
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

