"use server";
// بريد المالك لتجار المنصة: حملة لشريحة أو قائمة مختارة أو شخص واحد. الإرسال على دفعات صغيرة من المتصفح
// (لا مهلة خادم تقطعه، وشريط تقدم حقيقي)، وكل رسالة فيها رابط إيقاف الرسائل، ومن أوقفها لا تصله أبداً.
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { outreachCampaigns } from "@/db/schema";
import { getPlatformSession } from "@/server/auth";
import { sendTemplatedEmail } from "@/lib/email";
import { GenericEmail } from "@/lib/email-templates/GenericEmail";
import { loadAudience, personalize, unsubscribeUrl, SEGMENTS, type AudienceRow } from "@/server/outreach";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const draftSchema = z.object({
  subject: z.string().trim().min(3, "اكتب عنوان الرسالة").max(150),
  headline: z.string().trim().max(150).optional().or(z.literal("")),
  body: z.string().trim().min(10, "اكتب نص الرسالة").max(5000),
  buttonTitle: z.string().trim().max(40).optional().or(z.literal("")),
  buttonUrl: z.string().trim().url("رابط الزر غير صحيح").max(500).optional().or(z.literal("")),
});
type Draft = z.infer<typeof draftSchema>;

async function owner() {
  const u = await getPlatformSession();
  if (!u) throw new Error("غير مصرح");
  return u;
}

function element(d: Draft, r: Pick<AudienceRow, "name" | "storeName" | "email">) {
  const paragraphs = personalize(d.body, r)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const buttons = d.buttonTitle && d.buttonUrl ? [{ title: personalize(d.buttonTitle, r), url: d.buttonUrl }] : [];
  return GenericEmail({
    storeName: "Colapia",
    headline: d.headline ? personalize(d.headline, r) : undefined,
    paragraphs: [...paragraphs, `لا تريد هذه الرسائل؟ أوقفها من هنا: ${unsubscribeUrl(r.email)}`],
    buttons,
  });
}

/** يبدأ حملة ويعيد قائمة المستلمين (بعد استبعاد من أوقف الرسائل) ليُرسل لهم على دفعات. */
export async function startCampaignAction(raw: unknown): Promise<Result<{ campaignId: string; recipients: string[] }>> {
  try {
    const u = await owner();
    const p = z
      .object({ draft: draftSchema, segment: z.enum(Object.keys(SEGMENTS) as [keyof typeof SEGMENTS, ...(keyof typeof SEGMENTS)[]]).or(z.literal("custom")), ids: z.array(z.string().uuid()).max(20_000).optional() })
      .safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "راجع الرسالة" };
    const { draft, segment, ids } = p.data;
    const audience = (await loadAudience()).filter((r) => !r.optedOut);
    const pick = new Set(ids ?? []);
    const recipients = audience.filter((r) => (segment === "custom" ? pick.has(r.id) : segment === "all" || r.segment === segment)).map((r) => r.id);
    if (!recipients.length) return { ok: false, error: "لا يوجد مستلمون في هذا الاختيار" };
    const [c] = await db
      .insert(outreachCampaigns)
      .values({
        subject: draft.subject,
        headline: draft.headline || null,
        body: draft.body,
        buttonTitle: draft.buttonTitle || null,
        buttonUrl: draft.buttonUrl || null,
        segment,
        recipients: recipients.length,
        createdBy: u.email ?? u.name,
      })
      .returning({ id: outreachCampaigns.id });
    return { ok: true, data: { campaignId: c!.id, recipients } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "تعذّر بدء الإرسال" };
  }
}

/** يرسل دفعة (حتى 20 مستلماً) من حملة قائمة. */
export async function sendCampaignBatchAction(campaignId: string, ids: string[]): Promise<Result<{ sent: number; failed: number }>> {
  try {
    await owner();
    if (!z.string().uuid().safeParse(campaignId).success || !z.array(z.string().uuid()).max(20).safeParse(ids).success)
      return { ok: false, error: "بيانات غير صالحة" };
    const [c] = await db.select().from(outreachCampaigns).where(eq(outreachCampaigns.id, campaignId)).limit(1);
    if (!c) return { ok: false, error: "الحملة غير موجودة" };
    const draft: Draft = { subject: c.subject, headline: c.headline ?? "", body: c.body, buttonTitle: c.buttonTitle ?? "", buttonUrl: c.buttonUrl ?? "" };
    const want = new Set(ids);
    const rows = (await loadAudience()).filter((r) => want.has(r.id) && !r.optedOut);
    let sent = 0;
    let failed = 0;
    for (const r of rows) {
      const res = await sendTemplatedEmail({
        to: r.email,
        subject: personalize(draft.subject, r),
        element: element(draft, r),
        senderKind: "hello",
        merchantId: r.id,
        entityId: campaignId,
        idempotencyKey: `outreach:${campaignId}:${r.id}`,
        tags: [{ name: "category", value: "outreach" }],
        tracking: true,
      }).catch(() => ({ ok: false }));
      if (res.ok) sent++;
      else failed++;
    }
    await db
      .update(outreachCampaigns)
      .set({
        sent: sql`${outreachCampaigns.sent} + ${sent}`,
        failed: sql`${outreachCampaigns.failed} + ${failed + (ids.length - rows.length)}`,
        finishedAt: new Date(),
      })
      .where(eq(outreachCampaigns.id, campaignId));
    revalidatePath("/admin/audience");
    return { ok: true, data: { sent, failed } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "تعذّر الإرسال" };
  }
}

/** رسالة تجربة لبريد المالك نفسه قبل الإرسال الفعلي. */
export async function sendTestEmailAction(raw: unknown): Promise<Result<{ to: string }>> {
  try {
    const u = await owner();
    const d = draftSchema.safeParse(raw);
    if (!d.success) return { ok: false, error: d.error.issues[0]?.message ?? "راجع الرسالة" };
    const to = u.email;
    if (!to) return { ok: false, error: "لا يوجد بريد لحسابك" };
    const r = await sendTemplatedEmail({
      to,
      subject: `[تجربة] ${personalize(d.data.subject, { name: u.name, storeName: "متجر تجريبي" })}`,
      element: element(d.data, { name: u.name, storeName: "متجر تجريبي", email: to }),
      senderKind: "hello",
      tracking: false,
    });
    return r.ok ? { ok: true, data: { to } } : { ok: false, error: r.error === "email_disabled" ? "البريد غير مفعّل (RESEND_API_KEY)" : `تعذّر الإرسال: ${r.error ?? ""}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "تعذّر الإرسال" };
  }
}
