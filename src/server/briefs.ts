import "server-only";
// server/briefs.ts — حفظ استمارات العملاء وقراءتها للوحة المالك، بضمان ألا تضيع أي استمارة:
//   1) جدول client_briefs (الأساس؛ المعرّف من المتصفح فإعادة الإرسال لا تكرر).
//   2) إن تعذر (الجدول لم يُنشأ بعد لأن migration 0020 لم تُطبَّق، أو خطأ مؤقت): نسخة كاملة في system_events (scope=brief)،
//      وهو جدول قائم من خط الأساس.
//   3) إن تعذرت القاعدة كلها: نسخة في Redis (briefs:fallback).
//   4) دائماً: بريد للمالك بالملخص (وبالبريف كاملاً إن لم تُحفظ في الجدول) + إشعار في اللوحة.
// اللوحة تعرض الجدول والنسخ الاحتياطية معاً، وتنقل الاحتياطي إلى الجدول تلقائياً متى صار موجوداً (drainBriefFallbacks).
import { after } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { clientBriefs, systemEvents } from "@/db/schema";
import { env, getOwnerAlertEmails } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { redis } from "@/lib/redis";
import { dbErrorInfo, PG_UNIQUE } from "@/lib/db-errors";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { BRIEF_KIND, briefDataSchema, isBriefStatus, type BriefData, type BriefStatus } from "@/briefs/realestate";
import { briefSummaryLines, renderBriefMarkdown } from "@/briefs/render";

export const BRIEF_FALLBACK_SCOPE = "brief";
const REDIS_FALLBACK_KEY = "briefs:fallback";
const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export type BriefRecord = {
  id: string;
  ref: string;
  kind: string;
  status: BriefStatus;
  businessName: string;
  contactName: string;
  whatsapp: string;
  email: string | null;
  data: BriefData;
  meta: Record<string, unknown>;
  note: string | null;
  isTest: boolean;
  seenAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** db = في الجدول؛ fallback = نسخة احتياطية لم تُنقل بعد (لا تُعدَّل حالتها حتى تُنقل). */
  source: "db" | "fallback";
};

export type SaveResult = { ok: true; ref: string; stored: "db" | "fallback" | "redis" | "email"; duplicate?: boolean } | { ok: false };

const origin = () => (env.ROOT_DOMAIN.startsWith("localhost") ? "http://localhost:3100" : `https://${env.ROOT_DOMAIN}`);

export function newBriefRef(prefix = "RE"): string {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return `${prefix}-${Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("")}`;
}

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : typeof v === "string" ? v : new Date(0).toISOString());

/** صف من أي مصدر (الجدول، أو نسخة JSON احتياطية) إلى سجل موحّد، أو null إن كانت بياناته تالفة. */
function toRecord(row: Record<string, unknown>, source: BriefRecord["source"]): BriefRecord | null {
  const parsed = briefDataSchema.safeParse(row.data);
  if (!parsed.success || typeof row.id !== "string" || typeof row.ref !== "string") return null;
  return {
    id: row.id,
    ref: row.ref,
    kind: typeof row.kind === "string" ? row.kind : BRIEF_KIND,
    status: isBriefStatus(row.status) ? row.status : "new",
    businessName: parsed.data.businessName,
    contactName: parsed.data.contactName,
    whatsapp: parsed.data.whatsapp,
    email: parsed.data.email || null,
    data: parsed.data,
    meta: (row.meta && typeof row.meta === "object" ? row.meta : {}) as Record<string, unknown>,
    note: typeof row.note === "string" ? row.note : null,
    isTest: row.isTest === true,
    seenAt: row.seenAt ? iso(row.seenAt) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt ?? row.createdAt),
    source,
  };
}

type NewBrief = { id: string; data: BriefData; meta: Record<string, unknown>; isTest: boolean };

function rowFor(b: NewBrief, ref: string) {
  return {
    id: b.id,
    ref,
    kind: BRIEF_KIND,
    status: "new",
    businessName: b.data.businessName,
    contactName: b.data.contactName,
    whatsapp: b.data.whatsapp,
    email: b.data.email || null,
    data: b.data as unknown as Record<string, unknown>,
    meta: b.meta,
    isTest: b.isTest,
  };
}

/** يحفظ استمارة جديدة بأول طريق متاح، ويرسل التنبيهات مرة واحدة لكل استمارة. لا يرمي أبداً. */
export async function saveBrief(b: NewBrief): Promise<SaveResult> {
  const now = new Date().toISOString();
  let ref = newBriefRef();
  let stored: "db" | "fallback" | "redis" | null = null;
  let dbError = "";

  // 1) الجدول.
  for (let attempt = 0; attempt < 4 && !stored; attempt++) {
    try {
      const rows = await db.insert(clientBriefs).values(rowFor(b, ref)).onConflictDoNothing({ target: clientBriefs.id }).returning({ ref: clientBriefs.ref });
      if (rows[0]) {
        stored = "db";
        break;
      }
      // المعرّف موجود: إعادة إرسال للاستمارة نفسها (انقطاع بعد الحفظ). نعيد رقمها بلا تنبيه جديد.
      const [existing] = await db.select({ ref: clientBriefs.ref }).from(clientBriefs).where(eq(clientBriefs.id, b.id)).limit(1);
      if (existing) return { ok: true, ref: existing.ref, stored: "db", duplicate: true };
    } catch (e) {
      const info = dbErrorInfo(e);
      if (info.code === PG_UNIQUE && info.constraint === "client_briefs_ref_uq") {
        ref = newBriefRef();
        continue;
      }
      dbError = e instanceof Error ? e.message.slice(0, 300) : String(e).slice(0, 300);
      console.error("[briefs] table insert failed, using fallback", dbError);
      break;
    }
  }

  // 2) نسخة احتياطية في system_events.
  if (!stored) {
    try {
      const [dup] = await db
        .select({ ref: sql<string>`${systemEvents.data}->>'ref'` })
        .from(systemEvents)
        .where(and(eq(systemEvents.scope, BRIEF_FALLBACK_SCOPE), sql`${systemEvents.data}->>'id' = ${b.id}`))
        .limit(1);
      if (dup?.ref) return { ok: true, ref: dup.ref, stored: "fallback", duplicate: true };
      await db.insert(systemEvents).values({
        level: "warn",
        scope: BRIEF_FALLBACK_SCOPE,
        actor: "client",
        message: `استمارة ${ref} محفوظة احتياطياً (جدول client_briefs غير متاح)`,
        data: { ...rowFor(b, ref), createdAt: now, dbError },
      });
      stored = "fallback";
    } catch (e) {
      console.error("[briefs] system_events fallback failed", e);
    }
  }

  // 3) Redis.
  if (!stored) {
    try {
      const prev = await redis.hget<{ ref?: string }>(REDIS_FALLBACK_KEY, b.id);
      if (prev?.ref) return { ok: true, ref: prev.ref, stored: "redis", duplicate: true };
      await redis.hset(REDIS_FALLBACK_KEY, { [b.id]: JSON.stringify({ ...rowFor(b, ref), createdAt: now }) });
      stored = "redis";
    } catch (e) {
      console.error("[briefs] redis fallback failed", e);
    }
  }

  // التنبيهات بعد الرد ما دامت الاستمارة محفوظة (لا تؤخر شاشة النجاح)؛ وإلا فالبريد هو النسخة الوحيدة فننتظره.
  if (stored) {
    const where = stored;
    after(async () => {
      await alertOwner(b, ref, where);
      await confirmToClient(b, ref);
    });
    return { ok: true, ref, stored };
  }
  const mailed = await alertOwner(b, ref, null);
  if (!mailed) return { ok: false };
  after(() => confirmToClient(b, ref));
  return { ok: true, ref, stored: "email" };
}

async function alertOwner(b: NewBrief, ref: string, stored: "db" | "fallback" | "redis" | null): Promise<boolean> {
  const d = b.data;
  const test = b.isTest ? " (تجريبية)" : "";
  await notifyAdmin(`استمارة عقارية جديدة${test}: ${d.businessName} · ${d.contactName} · ${d.whatsapp} (${ref})`, { briefId: b.id, ref }).catch(() => {});
  const to = getOwnerAlertEmails();
  if (!to.length) return false;
  const warning =
    stored === "db"
      ? null
      : stored
        ? "تنبيه: حُفظت الاستمارة نسخة احتياطية لأن جدول الاستمارات غير متاح (شغّلوا npm run db:migrate). تظهر في اللوحة وتنتقل للجدول تلقائياً."
        : "تنبيه: تعذر حفظ الاستمارة في القاعدة. هذا البريد هو النسخة الوحيدة منها، والبريف كاملاً بالأسفل.";
  const full = stored === "db" ? [] : renderBriefMarkdown(d, { id: b.id, ref, createdAt: new Date(), isTest: b.isTest }).split("\n\n");
  return sendEmail({
    to,
    subject: `استمارة عقارية جديدة${test}: ${d.businessName} · ${ref}`,
    headline: `${d.businessName} ملأ استمارة الموقع العقاري`,
    paragraphs: [...(warning ? [warning] : []), ...briefSummaryLines(d), ...full],
    buttons: [
      { title: "افتحوا الاستمارة", url: `${origin()}/admin/briefs/${b.id}` },
      { title: "كل الاستمارات", url: `${origin()}/admin/briefs` },
    ],
  }).catch(() => false);
}

/** تأكيد للعميل إن كتب بريده (مرة لكل استمارة). */
async function confirmToClient(b: NewBrief, ref: string): Promise<void> {
  if (!b.data.email || b.isTest) return;
  await sendEmail({
    to: b.data.email,
    subject: `استلمنا استمارة موقع ${b.data.businessName} (${ref})`,
    headline: "وصلتنا استمارتكم، شكراً لكم",
    paragraphs: [
      `أهلاً ${b.data.contactName}، استلمنا استمارة موقع «${b.data.businessName}» برقم ${ref}.`,
      "سيتواصل معكم فريق Colapia على واتساب لتأكيد التفاصيل، ثم نجهّز موقعكم ونسلّمه لكم في اجتماع قصير نربط فيه كل شيء ونطلقه.",
      "عند أول فتح للموقع سيقودكم «الإعداد الأول» خطوة بخطوة لإضافة الشعار والعقارات وروابط التواصل.",
    ],
  }).catch(() => false);
}

// ─── القراءة للوحة المالك ────────────────────────────────────────────────

export type BriefsView = { briefs: BriefRecord[]; tableReady: boolean; pendingFallback: number };

async function fallbackRows(): Promise<{ events: { eventId: string; rec: BriefRecord }[]; redisRecs: BriefRecord[] }> {
  const events = await db
    .select({ id: systemEvents.id, data: systemEvents.data, createdAt: systemEvents.createdAt })
    .from(systemEvents)
    .where(eq(systemEvents.scope, BRIEF_FALLBACK_SCOPE))
    .orderBy(desc(systemEvents.createdAt))
    .limit(500)
    .then((rows) =>
      rows.flatMap((r) => {
        const rec = toRecord({ ...(r.data ?? {}), createdAt: (r.data as { createdAt?: string } | null)?.createdAt ?? r.createdAt }, "fallback");
        return rec ? [{ eventId: r.id, rec }] : [];
      })
    )
    .catch(() => []);
  const redisRecs = await redis
    .hgetall<Record<string, unknown>>(REDIS_FALLBACK_KEY)
    .then((all) =>
      Object.values(all ?? {}).flatMap((v) => {
        const obj = typeof v === "string" ? (JSON.parse(v) as Record<string, unknown>) : (v as Record<string, unknown>);
        const rec = obj ? toRecord(obj, "fallback") : null;
        return rec ? [rec] : [];
      })
    )
    .catch(() => []);
  return { events, redisRecs };
}

/**
 * ينقل النسخ الاحتياطية إلى الجدول متى صار متاحاً (idempotent بالمعرّف)، ثم يحذفها من مكانها الاحتياطي.
 * يُستدعى عند فتح لوحة الاستمارات، فلا تحتاج أي خطوة يدوية بعد تشغيل migration 0020.
 */
export async function drainBriefFallbacks(): Promise<number> {
  const { events, redisRecs } = await fallbackRows();
  let moved = 0;
  const all = [...events.map((e) => ({ rec: e.rec, eventId: e.eventId as string | null })), ...redisRecs.map((rec) => ({ rec, eventId: null }))];
  for (const { rec, eventId } of all) {
    try {
      await db
        .insert(clientBriefs)
        .values({ ...rowFor({ id: rec.id, data: rec.data, meta: rec.meta, isTest: rec.isTest }, rec.ref), createdAt: new Date(rec.createdAt) })
        .onConflictDoNothing({ target: clientBriefs.id });
    } catch (e) {
      const info = dbErrorInfo(e);
      if (info.code === PG_UNIQUE) {
        // رقم مستخدم مصادفةً: نعطيها رقماً جديداً ولا نفقدها.
        try {
          await db.insert(clientBriefs).values({ ...rowFor({ id: rec.id, data: rec.data, meta: rec.meta, isTest: rec.isTest }, newBriefRef()), createdAt: new Date(rec.createdAt) }).onConflictDoNothing({ target: clientBriefs.id });
        } catch {
          continue;
        }
      } else {
        return moved; // الجدول غير متاح بعد: تبقى النسخ كما هي.
      }
    }
    if (eventId) await db.delete(systemEvents).where(eq(systemEvents.id, eventId)).catch(() => {});
    else await redis.hdel(REDIS_FALLBACK_KEY, rec.id).catch(() => {});
    moved++;
  }
  return moved;
}

/** كل الاستمارات (الجدول + ما بقي احتياطياً) الأحدث أولاً. */
export async function listBriefs(): Promise<BriefsView> {
  await drainBriefFallbacks().catch(() => 0);
  let tableReady = true;
  const rows = await db
    .select()
    .from(clientBriefs)
    .orderBy(desc(clientBriefs.createdAt))
    .limit(1000)
    .catch(() => {
      tableReady = false;
      return [];
    });
  const fromDb = rows.flatMap((r) => toRecord(r as unknown as Record<string, unknown>, "db") ?? []);
  const seen = new Set(fromDb.map((r) => r.id));
  const { events, redisRecs } = await fallbackRows();
  const extra = [...events.map((e) => e.rec), ...redisRecs].filter((r) => !seen.has(r.id) && (seen.add(r.id), true));
  const briefs = [...fromDb, ...extra].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { briefs, tableReady, pendingFallback: extra.length };
}

/** استمارة واحدة بمعرّفها (من الجدول أو الاحتياطي)، وتُعلَّم «مقروءة». */
export async function getBrief(id: string, opts: { markSeen?: boolean } = {}): Promise<BriefRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(clientBriefs).where(eq(clientBriefs.id, id)).limit(1).catch(() => []);
  if (row) {
    if (opts.markSeen && !row.seenAt) await db.update(clientBriefs).set({ seenAt: new Date() }).where(eq(clientBriefs.id, id)).catch(() => {});
    return toRecord(row as unknown as Record<string, unknown>, "db");
  }
  const { events, redisRecs } = await fallbackRows();
  return [...events.map((e) => e.rec), ...redisRecs].find((r) => r.id === id) ?? null;
}

/** عدد الاستمارات غير المقروءة (شارة القائمة الجانبية). */
export async function unseenBriefsCount(): Promise<number> {
  const [r] = await db
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(clientBriefs)
    .where(sql`${clientBriefs.seenAt} is null and ${clientBriefs.status} <> 'archived'`)
    .catch(() => [{ c: 0 }]);
  const fallback = await db
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(systemEvents)
    .where(eq(systemEvents.scope, BRIEF_FALLBACK_SCOPE))
    .then((x) => x[0]?.c ?? 0)
    .catch(() => 0);
  return (r?.c ?? 0) + fallback;
}
