import "server-only";
// link.ts — رابط الاستمارة الذي يرسله وكيل إنستجرام/فيسبوك (أو الفريق) مملوءاً مسبقاً بما عُرف من المحادثة.
//
// رابط المحادثة مشتق من معرّفها (HMAC)، فإعادة إرساله تعطي نفس الرابط ونفس المسودة (لا يلغي رابطاً قديماً في
// المحادثة). البيانات المسبقة تملأ الحقول الفارغة فقط ولا تكتب فوق ما كتبه العميل، ولا تمر في الرابط نفسه أبداً
// (روابط الرسائل تظهر في المعاينات والسجلات). تحويل الوكيل لهذا الرابط بدل رابط البناء الذاتي يتم في المرحلة 8.
import { isDeepStrictEqual } from "node:util";
import { clientEnv } from "@/lib/env";
import { dbErrorInfo, PG_UNIQUE } from "@/lib/db-errors";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { stripEmoji } from "@/lib/emoji";
import { createDraft, draftIsOpen, findByDraftToken, reopenDraft, saveDraft, readData, type RequestRow } from "./repo";
import { emptyIntake, normalizeIntake, socialUrl, type IntakeData } from "./schema";
import { derivedToken } from "./tokens";
import type { RequestSource } from "@/db/schema/agency";

export type IntakePrefill = { storeName?: string | null; whatsapp?: string | null; social?: string | null; oneLine?: string | null };

export const intakeUrl = (draftToken: string) => `${clientEnv.NEXT_PUBLIC_APP_URL}/start?d=${draftToken}`;

/** يملأ الفارغ فقط من بيانات المحادثة (منقّاة). */
export function applyPrefill(d: IntakeData, p: IntakePrefill): IntakeData {
  const txt = (v: string | null | undefined, max: number) => {
    const t = stripEmoji(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
    return t || undefined;
  };
  const wa = p.whatsapp ? normalizeEgyptianPhone(p.whatsapp) : null;
  const social = p.social ? socialUrl(p.social) : null;
  return {
    ...d,
    store: { name: d.store.name || txt(p.storeName, 60), oneLine: d.store.oneLine || txt(p.oneLine, 200) },
    contact: { ...d.contact, whatsapp: d.contact.whatsapp || wa || undefined },
    social: { ...d.social, url: d.social.url || social || undefined },
  };
}

/**
 * رابط استمارة لمحادثة (أو بلا محادثة لرابط عام من الفريق). يعيد نفس المسودة ما دامت مفتوحة.
 * submitted = العميل أرسل الطلب بالفعل من هذه المحادثة (المستدعي يرسل له رابط المتابعة بدل الاستمارة)، وclosed =
 * الطلب سبام أو مسحوب (لا رابط متابعة له ولا استمارة جديدة بنفس الرابط: المستدعي يحيل للفريق).
 */
export async function issueIntakeLink(input: {
  conversationId: string | null;
  source: RequestSource;
  prefill?: IntakePrefill;
}): Promise<{ url: string; requestId: string; status: "new" | "resumed" | "submitted" | "closed" }> {
  if (input.conversationId) {
    const token = derivedToken("agent-draft", input.conversationId);
    const resume = async (existing: RequestRow) => {
      if (existing.status === "submitted" || existing.status === "converted") return { url: intakeUrl(token), requestId: existing.id, status: "submitted" as const };
      if (existing.status !== "draft") return { url: intakeUrl(token), requestId: existing.id, status: "closed" as const };
      if (!draftIsOpen(existing)) await reopenDraft(existing.id);
      if (input.prefill) {
        const fresh = (await findByDraftToken(token)) ?? existing;
        const current = readData(fresh.data);
        const merged = applyPrefill(current, input.prefill);
        // لا نكتب (ولا نرفع نسخة المسودة) إن لم يتغير شيء: العميل قد يكون يكتب الآن ولا نريد أن نتسبب في تعارض حفظه.
        if (!isDeepStrictEqual(normalizeIntake(merged), normalizeIntake(current))) await saveDraft(fresh, fresh.draftVersion, merged);
      }
      return { url: intakeUrl(token), requestId: existing.id, status: "resumed" as const };
    };
    const existing = await findByDraftToken(token);
    if (existing) return resume(existing);
    // لا مسودة لهذه المحادثة (أو حُذفت بعد انتهاء مهلتها): مسودة جديدة بنفس الرابط المشتق.
    try {
      const { row } = await createDraft({ data: applyPrefill(emptyIntake(), input.prefill ?? {}), source: input.source, conversationId: input.conversationId, token });
      return { url: intakeUrl(token), requestId: row.id, status: "new" };
    } catch (e) {
      // طلبان متزامنان لنفس المحادثة (إعادة إرسال webhook): الثاني يجد مسودة الأول.
      if (dbErrorInfo(e).code !== PG_UNIQUE) throw e;
      const raced = await findByDraftToken(token);
      if (!raced) throw e;
      return resume(raced);
    }
  }
  const { row, token } = await createDraft({ data: applyPrefill(emptyIntake(), input.prefill ?? {}), source: input.source, conversationId: null });
  return { url: intakeUrl(token), requestId: row.id, status: "new" };
}
