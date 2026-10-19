import "server-only";
// setup-jobs.ts — دورة حياة المتجر قبل اكتمال إعداده (حالة setup). V3: التسليم يدوي بيد المالك، فلا يُرسل رابط الإعداد
// آلياً بعد مهلة (مهمة setup.link القديمة تتخطى نفسها). من لحظة التسليم (إرسال الرابط من اللوحة، أو تعليمه «أُرسل» بعد نسخه)
// تُجدول التذكيرات وحذف المتجر غير المكتمل بعد setupDays. تُسجَّل المعالجات في lifecycle/handlers.ts.
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations, stores } from "@/db/schema";
import { cancelJobs, schedule } from "@/lifecycle/scheduler";
import { recordEvent } from "@/lifecycle/machine";
import { deliverToMerchant } from "@/lifecycle/messenger";
import { purgeStore } from "@/server/store-purge";
import { mediaApi } from "@/server/media-host";
import { r2KeyFromUrl } from "@/lib/media";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { trace } from "@/lib/meta-trace";
import { setupLink } from "./tokens";
import { setupLinkMessage, setupReminderMessage, setupSchedule } from "./setup-messages";
import { agentConfig } from "./settings";

type Store = typeof stores.$inferSelect;

/** بعد تسليم رابط الإعداد: تذكيران وحذف المتجر غير المكتمل محسوبة من لحظة التسليم. المهمة الفاشلة في النشر يلتقطها الكنّاس. */
async function scheduleSetupFollowups(storeId: string, deliveredAt: Date) {
  const cfg = await agentConfig();
  const t = setupSchedule(deliveredAt, { delayMinutes: 0, setupDays: cfg.setupDays });
  await cancelJobs(storeId, ["setup.link"]).catch(() => {});
  await schedule(storeId, "setup.reminder_24h", t.reminder24);
  await schedule(storeId, "setup.reminder_72h", t.reminder72);
  await schedule(storeId, "setup.purge", t.purge);
}

/**
 * يعلّم أن رابط الإعداد سُلِّم للتاجر (نسخه المالك وأرسله بنفسه، أو أرسله من صفحة المحادثة)، ويبدأ من هذه اللحظة التذكيرات
 * ومهلة الحذف. لا يغيّر موعد تسليم سابق (المرة الأولى هي المعتبرة).
 */
export async function markSetupLinkSent(storeId: string, actor: string, via: "copy" | "channel" | "auto" = "copy"): Promise<{ ok: true; first: boolean } | { ok: false; error: string }> {
  const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) return { ok: false, error: "المتجر غير موجود" };
  if (store.status !== "setup") return { ok: false, error: "هذا المتجر أكمل إعداده بالفعل." };
  const first = !sentAt(store, "linkSentAt");
  const now = new Date();
  if (first) {
    await patchOnboarding(store.id, { linkSentAt: now.toISOString(), linkSentVia: via });
    await scheduleSetupFollowups(store.id, now);
  }
  await db.update(conversations).set({ stage: "link_sent", updatedAt: now }).where(eq(conversations.storeId, store.id));
  await recordEvent({ storeId: store.id, storeRef: store.subdomain, type: "setup.link_sent", actor, data: { via, first } });
  return { ok: true, first };
}

/** دمج ذري في stores.onboarding (لا يمحو ما كتبه مسار الإعداد). */
async function patchOnboarding(storeId: string, patch: Record<string, unknown>) {
  await db
    .update(stores)
    .set({ onboarding: sql`${stores.onboarding} || ${JSON.stringify(patch)}::jsonb`, updatedAt: new Date() })
    .where(eq(stores.id, storeId));
}

const sentAt = (s: Store, key: string): string | null => {
  const v = (s.onboarding as Record<string, unknown> | null)?.[key];
  return typeof v === "string" ? v : null;
};

export type SendLinkResult = { skip: string } | { sent: true; viaMeta: boolean; emailed: boolean };

/**
 * يرسل رابط الإعداد (رسالة في المحادثة + بريد). مرة واحدة ما لم يُطلب `force` (زر المالك «أرسل الآن» أو إعادة الإرسال).
 */
export async function sendSetupLink(storeId: string, opts: { force?: boolean } = {}): Promise<SendLinkResult> {
  const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
  if (!store) return { skip: "store_not_found" };
  if (store.status !== "setup") return { skip: `status:${store.status}` };
  if (!opts.force && sentAt(store, "linkSentAt")) return { skip: "already_sent" };

  const m = setupLinkMessage({ storeName: store.name });
  const report = await deliverToMerchant(store.id, {
    key: `setup.link:${store.id}:${opts.force ? Date.now() : "first"}`,
    text: m.text,
    buttons: [{ title: m.buttonTitle, url: setupLink(store.id) }],
    purpose: "transactional",
    email: { subject: m.subject },
  });
  if (report.undelivered) {
    // لا نعلّمه مُرسلاً: تُعاد المحاولة (المهمة تفشل فيعيدها الكنّاس) وفريقنا ينبَّه من deliverToMerchant.
    throw new Error("تعذّر توصيل رابط الإعداد (لا محادثة مفتوحة ولا بريد صالح)");
  }
  const first = !sentAt(store, "linkSentAt");
  const now = new Date();
  if (first) {
    await patchOnboarding(store.id, { linkSentAt: now.toISOString(), linkSentVia: "message" });
    await scheduleSetupFollowups(store.id, now);
  }
  await db.update(conversations).set({ stage: "link_sent", updatedAt: now }).where(eq(conversations.storeId, store.id));
  await recordEvent({ storeId: store.id, storeRef: store.subdomain, type: "setup.link_sent", actor: opts.force ? "owner" : "system", data: { ...report } });
  await trace("setup-link", `${store.subdomain} meta=${report.viaMeta} email=${report.emailed}`);
  return { sent: true, viaMeta: report.viaMeta, emailed: report.emailed };
}

async function remind(store: Store, kind: "24h" | "72h") {
  if (store.status !== "setup") return { skip: `status:${store.status}` };
  // لا تذكير قبل أن يصله الرابط أصلاً.
  if (!sentAt(store, "linkSentAt")) return { skip: "link_not_sent" };
  const m = setupReminderMessage(kind, { storeName: store.name });
  const report = await deliverToMerchant(store.id, {
    key: `setup.reminder_${kind}:${store.id}`,
    text: m.text,
    buttons: [{ title: m.buttonTitle, url: setupLink(store.id) }],
    purpose: "transactional",
    email: { subject: m.subject },
  });
  return { ...report };
}

export const setupHandlers = {
  /** V3: لا إرسال آلي لرابط الإعداد. مهام قديمة مجدولة قبل التحويل تتخطى نفسها؛ التسليم يدوي من صفحة المحادثة. */
  "setup.link": async (_s: Store) => ({ skip: "manual_delivery" }),
  "setup.reminder_24h": async (s: Store) => remind(s, "24h"),
  "setup.reminder_72h": async (s: Store) => remind(s, "72h"),
  /** حذف المتجر غير المكتمل نهائياً (بياناته وصوره وصفه) ليتحرر النطاق الفرعي. */
  "setup.purge": async (s: Store) => {
    if (s.status !== "setup") return { skip: `status:${s.status}` };
    // لا حذف لمتجر لم يُسلَّم رابطه بعد (ينتظر المالك)، ولا قبل انقضاء المهلة من لحظة التسليم (مهام قديمة حُسبت من الإنشاء).
    const delivered = sentAt(s, "linkSentAt");
    if (!delivered) return { skip: "not_delivered" };
    const { setupDays } = await agentConfig();
    if (Date.now() - new Date(delivered).getTime() < setupDays * 86_400_000 - 3_600_000) return { skip: "grace" };
    const dm = (((s.onboarding as Record<string, unknown> | null)?.dmImages as unknown[]) ?? []).filter((u): u is string => typeof u === "string");
    const keys = dm.map((u) => r2KeyFromUrl(u)).filter((k): k is string => Boolean(k));
    const okData = await purgeStore(s);
    if (!okData) throw new Error("تعذّر حذف بيانات المتجر غير المكتمل");
    if (keys.length) {
      const api = await mediaApi().catch(() => null);
      await api?.remove(keys).catch(() => false);
    }
    // فك الروابط التي بلا حذف تلقائي ثم حذف الصف نفسه لتحرير النطاق الفرعي.
    await db.update(conversations).set({ storeId: null, stage: "lost", lostReason: "setup_expired", updatedAt: new Date() }).where(eq(conversations.storeId, s.id));
    await db.execute(sql`update intakes set store_id = null where store_id = ${s.id}`).catch(() => {});
    await db.delete(stores).where(eq(stores.id, s.id));
    await notifyAdmin(`حُذف متجر لم يكتمل إعداده: ${s.name} (${s.subdomain})`, { storeId: s.id }).catch(() => {});
    return { purged: true };
  },
};
