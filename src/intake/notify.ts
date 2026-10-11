import "server-only";
// notify.ts — ما يحدث بعد إرسال الطلب أو نقل مرحلته: بريد فوري للمالك والفريق، وبريد تأكيد للعميل (إن كتب
// بريده)، وحدث في سجل المالك. كل بريد يُرسل مرة واحدة (شرط *_at IS NULL في التحديث + مفتاح idempotency)، وفشل
// البريد لا يُفشل الإرسال أبداً: الطلب محفوظ ويظهر في اللوحة بشارة «جديد» في كل الأحوال.
import { and, asc, eq, gt, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { createElement } from "react";
import { db } from "@/db/client";
import { platformUsers } from "@/db/schema";
import { storeRequestEvents, storeRequests, type RequestStage } from "@/db/schema/agency";
import { clientEnv, env, getOwnerAlertEmails } from "@/lib/env";
import { sendTemplatedEmail } from "@/lib/email";
import { redis } from "@/lib/redis";
import { waLink } from "@/lib/whatsapp";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { DELIVERY_OPTIONS, PAYMENT_OPTIONS, safeUrl, socialUrl, type IntakeData } from "./schema";
import { paletteById } from "./palettes";
import { STAGE_INFO } from "./stages";
import { etaText } from "./eta";
import { derivedToken } from "./tokens";
import { RequestReceivedClientEmail, RequestTeamAlertEmail, StageChangedClientEmail, type TeamAlertRow } from "./emails";
import { emailKey } from "./guard";
import { readData, requestAssets, type AssetRow, type RequestRow } from "./repo";

const app = () => clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
export const followUrl = (requestId: string) => `${app()}/follow/${derivedToken("track", requestId)}`;
export const confirmUrl = (requestId: string) => `${app()}/api/intake/confirm?r=${requestId}&t=${derivedToken("confirm", requestId)}`;
export const adminRequestUrl = (requestId: string) => `${app()}/admin/requests/${requestId}`;
export const agencyWhatsappUrl = (text?: string) => (env.AGENCY_WHATSAPP ? waLink(env.AGENCY_WHATSAPP, text) : null);

/** المالك (OWNER_ALERT_EMAILS والمالكون) + كل أعضاء فريق الوكالة النشطين. */
export async function teamRecipients(): Promise<string[]> {
  const team = await db
    .select({ email: platformUsers.email })
    .from(platformUsers)
    .where(eq(platformUsers.isActive, true))
    .catch(() => [] as { email: string }[]);
  return Array.from(new Set([...getOwnerAlertEmails(), ...team.map((t) => t.email.trim().toLowerCase())].filter((e) => e.includes("@"))));
}

function teamRows(r: RequestRow, d: IntakeData): TeamAlertRow[] {
  const rows: TeamAlertRow[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value && value.trim()) rows.push({ label, value: value.trim() });
  };
  add("النشاط", d.store.oneLine);
  add("واتساب", r.whatsapp ?? d.contact.whatsapp);
  add("البريد (مالك اللوحة)", r.email ? `${r.email} (غير مؤكد بعد)` : null);
  const social = socialUrl(d.social.url);
  add("الصفحة", social ? `${social}${d.social.teamCollects ? " — الفريق يجمع المنتجات منها" : ""}` : null);
  const palette = paletteById(d.colors.preset);
  add(
    "الألوان",
    d.colors.mode === "preset" && palette ? palette.name : d.colors.mode === "logo" ? "من الشعار" : d.colors.mode === "custom" ? d.colors.custom : d.colors.mode === "team" ? "سيبها للفريق" : null,
  );
  add("الشعار", d.logo.key ? "مرفوع" : d.logo.team ? "سيبها للفريق" : null);
  add(
    "المنتجات",
    d.products.mode === "team" ? "الفريق يجمعها" : d.products.mode === "later" ? "يضيفها بنفسه لاحقاً" : d.products.items.length ? `${d.products.items.length} (صورة وسطر)` : null,
  );
  add("الدفع", d.payment.unsure ? "مش متأكد" : d.payment.methods.map((m) => PAYMENT_OPTIONS.find((o) => o.id === m)?.label ?? m).join("، "));
  add("الشحن", [DELIVERY_OPTIONS.find((o) => o.id === d.delivery.scope)?.label, d.delivery.note].filter(Boolean).join(" — "));
  add("موقع إلهام", safeUrl(d.inspiration.url) ?? (d.inspiration.team ? "سيبها للفريق" : null));
  add("المصدر", [r.source, r.utm?.utm_source, r.utm?.utm_campaign].filter(Boolean).join(" / "));
  return rows;
}

/** سبب فشل البريد مقروءاً للفريق (رسالة Resend بدل JSON خام). */
function emailError(e: string | undefined): string {
  if (!e) return "سبب غير معروف";
  try {
    const j = JSON.parse(e) as { message?: unknown };
    if (typeof j.message === "string") return j.message.slice(0, 120);
  } catch {
    /* نص عادي */
  }
  return e.slice(0, 120);
}

async function logEvent(requestId: string, internalNote: string) {
  await db.insert(storeRequestEvents).values({ requestId, type: "email", internalNote, actor: "system" }).catch(() => {});
}

/** يعيد علامة «أُرسل» إلى null ليُعاد المحاولة (من الإرسال المكرر أو من ops/tick) حين يفشل البريد فعلاً. */
async function releaseTurn(requestId: string, column: "teamNotifiedAt" | "clientEmailedAt") {
  await db
    .update(storeRequests)
    .set({ [column]: null })
    .where(eq(storeRequests.id, requestId))
    .catch((e) => console.error("[intake] release notify turn failed", e));
}

/**
 * بعد الإرسال مباشرة (داخل after() حتى لا يؤخر رد الاستمارة). كل بريد يُحجز دوره أولاً (شرط *_at IS NULL) فلا
 * يتكرر، ويُعاد الدور (null) إن فشل الإرسال فعلاً حتى تعيده ops/tick أو إعادة إرسال الاستمارة؛ فالطلب لا يبقى بلا
 * تنبيه للفريق بسبب عطل بريد مؤقت.
 */
export async function notifySubmitted(r: RequestRow, d: IntakeData, assets: AssetRow[]): Promise<void> {
  const name = r.storeName ?? "متجر جديد";
  const eta = r.etaFrom && r.etaTo && r.submittedAt ? etaText({ fromHours: hoursBetween(r.submittedAt, r.etaFrom), toHours: hoursBetween(r.submittedAt, r.etaTo) }) : "هنبلغك بالموعد";

  // 1) المالك والفريق: مرة واحدة لكل طلب.
  const [teamTurn] = await db
    .update(storeRequests)
    .set({ teamNotifiedAt: new Date() })
    .where(and(eq(storeRequests.id, r.id), isNull(storeRequests.teamNotifiedAt)))
    .returning({ id: storeRequests.id });
  if (teamTurn) {
    const to = await teamRecipients();
    const byKey = new Map(assets.map((a) => [a.key, a]));
    const voice = d.voice.key ? byKey.get(d.voice.key) : undefined;
    const images = [d.logo.key, ...d.products.items.map((p) => p.key)].map((k) => (k ? byKey.get(k)?.url : undefined)).filter((u): u is string => Boolean(u));
    if (to.length) {
      let ok = false;
      try {
        const res = await sendTemplatedEmail({
          to,
          subject: `طلب متجر جديد: ${name} (${r.code})`,
          element: createElement(RequestTeamAlertEmail, {
            storeName: name,
            code: r.code,
            adminUrl: adminRequestUrl(r.id),
            whatsappUrl: r.whatsapp ? waLink(r.whatsapp, `أهلاً، معاك فريق Colapia بخصوص طلب متجر «${name}» (${r.code}).`) : null,
            rows: teamRows(r, d),
            images,
            voiceUrl: voice?.url ?? null,
            transcript: (d.voice.transcript ?? voice?.transcript ?? "").slice(0, 1200) || null,
            notes: d.notes?.slice(0, 1500) ?? null,
            etaText: eta,
          }),
          senderKind: "hello",
          fromName: "Colapia",
          idempotencyKey: `intake:${r.id}:team`,
          tracking: false,
          entityId: r.id,
        });
        ok = res.ok;
        await logEvent(r.id, res.ok ? `تنبيه الفريق أُرسل إلى ${to.length} بريد` : `تعذر إرسال تنبيه الفريق: ${emailError(res.error)}`);
      } catch (e) {
        console.error("[intake] team email threw", e);
      }
      if (!ok) await releaseTurn(r.id, "teamNotifiedAt");
    }
    await notifyAdmin(`طلب متجر جديد: ${name} (${r.code})`, { requestId: r.id, code: r.code });
  }

  // 2) العميل: إن كتب بريده، مرة لكل طلب، وبحد رسالة تأكيد واحدة لكل عنوان يومياً (لا يُستخدم النموذج لإغراق بريد أحد).
  if (!r.email) return;
  const [clientTurn] = await db
    .update(storeRequests)
    .set({ clientEmailedAt: new Date() })
    .where(and(eq(storeRequests.id, r.id), isNull(storeRequests.clientEmailedAt)))
    .returning({ id: storeRequests.id });
  if (!clientTurn) return;
  // العنوان بصيغته الموحّدة (a.b+1@gmail.com = ab@gmail.com). عطل Redis = لا نرسل (نفضّل تأخير بريد على إغراق صندوق أحد).
  const mailKey = `intake:mail:${emailKey(r.email)}`;
  const first = await redis.set(mailKey, 1, { nx: true, ex: 86_400 }).catch(() => "ERR" as const);
  if (first === "ERR") {
    await logEvent(r.id, "تأجّل بريد التأكيد: تعذر فحص حد الإرسال لكل عنوان");
    await releaseTurn(r.id, "clientEmailedAt");
    return;
  }
  if (!first) {
    await logEvent(r.id, "لم يُرسل بريد التأكيد: وصل نفس العنوان بريد خلال 24 ساعة");
    return;
  }
  let ok = false;
  try {
    const res = await sendTemplatedEmail({
      to: r.email,
      // لا اسم المتجر في العنوان: يكتبه أي زائر، ولا نريد أن تُستعمل رسائلنا لنقل نص من اختيار غيرنا إلى صندوق غريب.
      subject: `استلمنا طلب متجرك (${r.code})`,
      element: createElement(RequestReceivedClientEmail, {
        storeName: name,
        code: r.code,
        etaText: eta,
        followUrl: followUrl(r.id),
        confirmUrl: confirmUrl(r.id),
        agencyWhatsappUrl: agencyWhatsappUrl(`أهلاً، بخصوص طلب متجر «${name}» (${r.code})`),
      }),
      senderKind: "hello",
      fromName: "Colapia",
      replyTo: env.INTAKE_REPLY_TO,
      idempotencyKey: `intake:${r.id}:client`,
      tracking: false,
      entityId: r.id,
    });
    ok = res.ok;
    await logEvent(r.id, res.ok ? "بريد التأكيد أُرسل للعميل" : `تعذر إرسال بريد التأكيد للعميل: ${emailError(res.error)}`);
  } catch (e) {
    console.error("[intake] client email threw", e);
  }
  if (!ok) {
    await releaseTurn(r.id, "clientEmailedAt");
    await redis.del(mailKey).catch(() => {});
  }
}

/** طلب لم يُبلَّغ فريقه أو عميله بعد (فشل بريد، أو توقفت الدالة قبل الإرسال): يعاد من تكرار الإرسال ومن ops/tick. */
export async function notifyIfPending(r: RequestRow): Promise<void> {
  if (r.status !== "submitted") return;
  if (r.teamNotifiedAt && (!r.email || r.clientEmailedAt)) return;
  await notifySubmitted(r, readData(r.data), await requestAssets(r.id));
}

/** تدارك دوري: طلبات مُرسلة منذ 5 دقائق إلى 3 أيام ما زال تنبيه فريقها أو تأكيد عميلها معلقاً. */
export async function retryPendingNotifications(limit = 20): Promise<number> {
  const rows = await db
    .select()
    .from(storeRequests)
    .where(
      and(
        eq(storeRequests.status, "submitted"),
        lt(storeRequests.submittedAt, sql`now() - interval '5 minutes'`),
        gt(storeRequests.submittedAt, sql`now() - interval '3 days'`),
        or(isNull(storeRequests.teamNotifiedAt), and(isNotNull(storeRequests.email), isNull(storeRequests.clientEmailedAt))),
      ),
    )
    .orderBy(asc(storeRequests.submittedAt))
    .limit(limit);
  for (const r of rows) await notifyIfPending(r).catch((e) => console.error("[intake] retry notify failed", r.id, e));
  return rows.length;
}

/** عند نقل المرحلة مع اختيار «أبلغ العميل»: بريد قصير بالمرحلة وملاحظة الفريق (إن كان للعميل بريد). */
export async function notifyStageChange(r: RequestRow, stage: RequestStage, note: string | null): Promise<boolean> {
  if (!r.email) return false;
  const info = STAGE_INFO[stage];
  const res = await sendTemplatedEmail({
    to: r.email,
    subject: `طلب متجرك (${r.code}): ${info.label}`,
    element: createElement(StageChangedClientEmail, {
      storeName: r.storeName ?? "",
      code: r.code,
      stageLabel: info.label,
      stageText: info.client,
      note,
      followUrl: followUrl(r.id),
    }),
    senderKind: "hello",
    fromName: "Colapia",
    replyTo: env.INTAKE_REPLY_TO,
    idempotencyKey: `intake:${r.id}:stage:${stage}:${Date.now().toString(36)}`,
    tracking: false,
    entityId: r.id,
  });
  return res.ok;
}

const hoursBetween = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 3_600_000));
