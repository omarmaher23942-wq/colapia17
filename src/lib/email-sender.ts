// email-sender.ts — عنوان المرسل الصحيح لكل بريد (منطق خالص مختبَر).
//
// السبب الجذري لـ«البريد لا يصل والنطاق موثّق في Resend»: عنوان الإرسال كان يُبنى من قيم لا تضمن النطاق الموثّق:
//  - EMAIL_FROM على نطاق آخر (مثل onboarding@resend.dev من أمثلة Resend، أو بريد Gmail) كان يُستخدم كما هو لكل
//    الرسائل، فيرفض Resend الإرسال لأي عنوان غير بريد صاحب الحساب (403) أو لأن النطاق غير موثّق.
//  - EMAIL_FROM الملصوق بتنصيص أو مسافات («"Colapia <hello@colapia.com>"») كان يُرسل حرفياً فيُرفض الحقل (422).
//  - النطاق كان يُقرأ من NEXT_PUBLIC_ROOT_DOMAIN المثبَّت وقت البناء (قد يكون localhost أو نطاق معاينة)، لا من وقت التشغيل.
// الآن: الإرسال دائماً من النطاق الرئيسي الموثّق (أو نطاق فرعي منه إن كان EMAIL_FROM عليه صراحةً)، والقيم تُنظَّف.

const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
export const FALLBACK_DOMAIN = "colapia.com";

/** النطاق الرئيسي كما يُكتب في المتغيرات (قد يحمل https:// أو www. أو منفذاً) ← نطاق صالح للبريد. */
export function normalizeMailDomain(raw: string | undefined | null): string {
  const d = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^['"`]|['"`]$/g, "")
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/^www\./, "")
    .replace(/\.$/, "");
  return DOMAIN_RE.test(d) ? d : FALLBACK_DOMAIN;
}

/** يحلل EMAIL_FROM بصيغه الشائعة: «Name <a@b.com>»، «a@b.com»، مع تنصيص أو مسافات أو «EMAIL_FROM=». */
export function parseFrom(raw: string | undefined | null): { name: string | null; address: string | null } {
  let s = String(raw ?? "").trim();
  s = s.replace(/^EMAIL_FROM\s*=\s*/i, "").trim();
  s = s.replace(/^(['"`])([\s\S]*)\1$/, "$2").trim();
  const m = /^([\s\S]*?)<\s*([^<>\s]+)\s*>\s*$/.exec(s);
  const address = (m ? (m[2] ?? "") : s).trim().toLowerCase();
  const name = m ? m[1]!.trim().replace(/^['"]|['"]$/g, "").trim() : "";
  const valid = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(address ?? "");
  return { name: name || null, address: valid ? address! : null };
}

export type SenderKind = "orders" | "hello" | "noreply" | "custom";

/** النطاق الذي يُرسل منه: الرئيسي، أو نطاق فرعي منه إن كان EMAIL_FROM عليه (نطاق إرسال موثّق خاص). */
export function senderDomain(rootDomain: string | undefined | null, emailFrom?: string | null): string {
  const root = normalizeMailDomain(rootDomain);
  const addr = parseFrom(emailFrom).address;
  const d = addr?.split("@")[1] ?? "";
  return d === root || d.endsWith(`.${root}`) ? d : root;
}

const cleanName = (v: string | null | undefined) => (v ?? "").replace(/[<>"\r\n]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);

/** «الاسم <بادئة@النطاق الموثّق>». الاسم: اسم المتجر لرسائل الطلبات، أو اسم EMAIL_FROM، أو Colapia. */
export function resolveSender(o: { kind: SenderKind; rootDomain: string | undefined | null; emailFrom?: string | null; fromName?: string | null }): string {
  const parsed = parseFrom(o.emailFrom);
  const domain = senderDomain(o.rootDomain, o.emailFrom);
  const onDomain = parsed.address?.endsWith(`@${domain}`) ?? false;
  const local =
    o.kind === "orders" ? "orders" : o.kind === "noreply" ? "noreply" : onDomain ? parsed.address!.split("@")[0]! : "hello";
  const name = cleanName(o.fromName) || cleanName(parsed.name) || "Colapia";
  return `${name} <${local}@${domain}>`;
}
