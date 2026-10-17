import "server-only";
// create-store.ts — الإنشاء الآلي للمتجر من محادثة الوكيل (V2-PLAN 2). يُستدعى من الكود فقط بعد أن يقرر `decideCreate`
// أن البيانات كاملة وموافقاً عليها. آمن للتكرار (idempotent): قفل Redis + قيد فريد على stores.source_conversation_id.
//
// الترتيب: قفل ← تحقق من المحادثة والبيانات ← حدود الإساءة ← التاجر (بالبريد القانوني) ← نطاق فرعي ← دفعة واحدة
// (المتجر بحالة setup + Blueprint الافتراضي + مناطق الشحن) ← ربط المحادثة ← إشعار المالك ← جدولة رابط الإعداد.
// لا محتوى وهمي: لا منتجات ولا نصوص مخترعة. المتجر مخفي تماماً حتى يكمل صاحبه الإعداد.
import { randomUUID } from "node:crypto";
import { and, eq, gte, like, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import { conversations, merchants, shippingZones, storeBlueprints, stores } from "@/db/schema";
import { blueprintSchema } from "@/blueprint/schema";
import { defaultBlueprint } from "@/blueprint/defaults";
import { defaultShippingZones } from "@/lib/egypt";
import { suggestSlug } from "@/agency/slug";
import { isValidSubdomain } from "@/lib/subdomains";
import { dbErrorInfo, PG_UNIQUE } from "@/lib/db-errors";
import { redis } from "@/lib/redis";
import { trace } from "@/lib/meta-trace";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { getOwnerAlertEmails } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { canonicalEmail } from "@/lib/contact";
import { isLeadComplete, type Lead } from "./lead";
import { agentConfig } from "./settings";
import { scheduleSetupJobs } from "./setup-jobs";

export type CreateResult =
  | { status: "created"; storeId: string; subdomain: string; merchantId: string }
  | { status: "exists"; storeId: string }
  | { status: "busy" }
  | { status: "incomplete" }
  /** لهذا البريد متجر قيد الإعداد لم يكتمل (متجر غير مكتمل واحد لكل بريد). */
  | { status: "setup_open"; storeId: string; subdomain: string }
  /** بلغ السقف اليومي للمتاجر المنشأة آلياً. */
  | { status: "capped" }
  | { status: "error"; error: string };

const LOCK_TTL_S = 90;
const CAP_ALERT_KEY = "agent:cap-alert";

const leadOf = (memory: unknown): Lead => ((memory as { lead?: Lead } | null)?.lead ?? {}) as Lead;

/** رمز قصير ثابت من معرّف المحادثة للاحتياط في اقتراح النطاق. */
const codeFrom = (convId: string) => convId.replace(/\D/g, "").slice(0, 6).padEnd(6, "0");

/** النطاقات المأخوذة التي تشبه الأساس (لاقتراح بديل دون سؤال القاعدة مرة لكل محاولة). */
async function takenLike(base: string): Promise<Set<string>> {
  const prefix = base.slice(0, 20);
  const rows = await db
    .select({ s: stores.subdomain })
    .from(stores)
    .where(like(stores.subdomain, `${prefix.replace(/[%_]/g, "")}%`))
    .limit(200)
    .catch(() => [] as { s: string }[]);
  return new Set(rows.map((r) => r.s));
}

/** التاجر بالبريد القانوني: موجود يُعاد استخدامه (ويُكمل canonical إن نقص)، وإلا يُنشأ. */
async function upsertMerchant(lead: Required<Pick<Lead, "email" | "storeName" | "whatsapp">> & Lead): Promise<string> {
  const canonical = lead.emailCanonical || canonicalEmail(lead.email);
  const [byCanon] = await db.select({ id: merchants.id, canon: merchants.emailCanonical }).from(merchants).where(eq(merchants.emailCanonical, canonical)).limit(1);
  const found = byCanon ?? (await db.select({ id: merchants.id, canon: merchants.emailCanonical }).from(merchants).where(eq(merchants.email, lead.email)).limit(1))[0];
  if (found) {
    if (!found.canon) await db.update(merchants).set({ emailCanonical: canonical, updatedAt: new Date() }).where(eq(merchants.id, found.id));
    return found.id;
  }
  const [m] = await db
    .insert(merchants)
    .values({ displayName: lead.storeName, email: lead.email, emailCanonical: canonical, phone: lead.whatsapp })
    .onConflictDoNothing()
    .returning({ id: merchants.id });
  if (m) return m.id;
  const [again] = await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.email, lead.email)).limit(1);
  if (!again) throw new Error("merchant upsert failed");
  return again.id;
}

async function alertCap(cap: number) {
  const first = await redis.set(CAP_ALERT_KEY, 1, { nx: true, ex: 6 * 3600 }).catch(() => null);
  if (!first) return;
  await notifyAdmin(`بلغ سقف المتاجر المنشأة آلياً اليوم (${cap}). توقف الإنشاء حتى الغد أو ارفع السقف من /admin/flags ← agent.`).catch(() => {});
  const to = getOwnerAlertEmails();
  if (!to.length) return;
  await sendEmail({
    to,
    subject: "بلغ السقف اليومي لإنشاء المتاجر آلياً",
    headline: "السقف اليومي للمتاجر",
    paragraphs: [`أُنشئ ${cap} متجراً من المحادثات خلال آخر 24 ساعة، فتوقف الإنشاء الآلي حمايةً من الإساءة. المحادثات الجديدة تُحوَّل لفريقكم.`, "إن كان هذا الطلب حقيقياً فارفعوا السقف من الإعدادات (المفتاح agent، الحقل dailyStoreCap)."],
  }).catch(() => {});
}

/**
 * ينشئ متجراً من المحادثة، أو يعيد حالة تفسّر لماذا لم يُنشأ. لا يرسل رسائل للعميل (المستدعي يرد بنص من الكود).
 */
export async function createStoreFromConversation(convId: string): Promise<CreateResult> {
  const lock = randomUUID();
  const lockKey = `agent:create:${convId}`;
  const got = await redis.set(lockKey, lock, { nx: true, ex: LOCK_TTL_S }).catch(() => "OK");
  if (!got) return { status: "busy" };
  try {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId)).limit(1);
    if (!conv) return { status: "error", error: "المحادثة غير موجودة" };

    // idempotent: متجر هذه المحادثة موجود (ربط المحادثة أو source_conversation_id).
    if (conv.storeId) return { status: "exists", storeId: conv.storeId };
    const [prior] = await db.select({ id: stores.id }).from(stores).where(eq(stores.sourceConversationId, convId)).limit(1);
    if (prior) {
      await db.update(conversations).set({ storeId: prior.id, updatedAt: new Date() }).where(eq(conversations.id, convId));
      return { status: "exists", storeId: prior.id };
    }

    const lead = leadOf(conv.memory);
    if (!isLeadComplete(lead)) return { status: "incomplete" };
    const full = lead as Required<Pick<Lead, "email" | "storeName" | "whatsapp" | "niche">> & Lead;
    const canonical = full.emailCanonical || canonicalEmail(full.email);
    const cfg = await agentConfig();

    // متجر غير مكتمل واحد لكل بريد.
    const [open] = await db
      .select({ id: stores.id, sub: stores.subdomain })
      .from(stores)
      .innerJoin(merchants, eq(merchants.id, stores.merchantId))
      .where(and(eq(merchants.emailCanonical, canonical), eq(stores.status, "setup")))
      .limit(1);
    if (open) return { status: "setup_open", storeId: open.id, subdomain: open.sub };

    // السقف اليومي العام (آخر 24 ساعة).
    const since = new Date(Date.now() - 24 * 3600_000);
    const [{ n } = { n: 0 }] = await db
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(stores)
      .where(and(sql`${stores.sourceConversationId} is not null`, gte(stores.createdAt, since)));
    if (n >= cfg.dailyStoreCap) {
      await alertCap(cfg.dailyStoreCap);
      return { status: "capped" };
    }

    const merchantId = await upsertMerchant(full);

    const bp = blueprintSchema.parse(
      defaultBlueprint({
        name: full.storeName,
        industry: full.niche,
        instagramUsername: full.instagram,
        whatsappNumber: full.whatsapp,
      })
    );
    const dmImages = (lead.assets ?? []).filter((u) => /^https:\/\//.test(u)).slice(0, 40);
    const now = new Date();

    // النطاق: من حساب إنستجرام ثم الاسم؛ والتصادم يُعاد بنطاق بديل.
    const base = (lead.instagram ?? full.storeName).toLowerCase();
    let taken = await takenLike(base);
    let storeId = "";
    let subdomain = "";
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = suggestSlug({ storeName: full.storeName, socialUrl: lead.instagram ? `https://www.instagram.com/${lead.instagram}/` : null, code: codeFrom(convId) }, (s) => taken.has(s));
      const candidate = attempt === 0 ? slug : `${slug.slice(0, 24)}-${Math.random().toString(36).slice(2, 6)}`;
      if (!isValidSubdomain(candidate)) continue;
      const id = randomUUID();
      const tdb = await getTenantDb(id);
      try {
        await db.batch([
          db.insert(stores).values({
            id,
            merchantId,
            subdomain: candidate,
            name: full.storeName,
            status: "setup",
            setupStartedAt: now,
            sourceConversationId: convId,
            onboarding: { step: "welcome", done: [], niche: full.niche, startedAt: now.toISOString(), ...(dmImages.length ? { dmImages } : {}) },
          }),
          db.insert(storeBlueprints).values({ storeId: id, data: bp, updatedBy: "agent:create" }),
          tdb.insert(shippingZones).values(defaultShippingZones().map((z) => ({ ...z, storeId: id }))),
        ]);
        storeId = id;
        subdomain = candidate;
        break;
      } catch (e) {
        const info = dbErrorInfo(e);
        if (info.code !== PG_UNIQUE) throw e;
        if (info.constraint?.includes("source_conversation")) {
          const [dup] = await db.select({ id: stores.id }).from(stores).where(eq(stores.sourceConversationId, convId)).limit(1);
          if (dup) return { status: "exists", storeId: dup.id };
        }
        taken = new Set([...taken, candidate]);
      }
    }
    if (!storeId) return { status: "error", error: "تعذّر حجز نطاق فرعي للمتجر" };

    await db
      .update(conversations)
      .set({ storeId, merchantId, stage: "building", updatedAt: new Date() })
      .where(eq(conversations.id, convId));

    await trace("store-created", `${subdomain} (محادثة …${convId.slice(-4)})`);
    await notifyAdmin(`أُنشئ متجر جديد من المحادثة: ${full.storeName} (${subdomain}). رابط الإعداد يُرسل بعد ${cfg.setupDelayMinutes} دقيقة، أو أرسلوه الآن من صفحة المحادثة.`, { conversationId: convId, storeId }).catch(() => {});
    await scheduleSetupJobs(storeId, { delayMinutes: cfg.setupDelayMinutes, setupDays: cfg.setupDays }).catch((e) => console.error("[create-store] scheduling failed", e));

    return { status: "created", storeId, subdomain, merchantId };
  } catch (e) {
    console.error("[create-store] failed", e);
    return { status: "error", error: String((e as Error)?.message ?? e).slice(0, 300) };
  } finally {
    // نفك القفل لصاحبه فقط.
    const cur = await redis.get<string>(lockKey).catch(() => null);
    if (cur === lock) await redis.del(lockKey).catch(() => {});
  }
}
