// email-track.ts — قاعدة وجهات النقر المتتبَّع في الرسائل (منطق خالص مختبَر): موقعنا فقط، منعاً لإعادة التوجيه المفتوحة.
import { normalizeMailDomain } from "@/lib/email-sender";

/** هل المضيف هو النطاق الرئيسي أو نطاق فرعي منه؟ (لا يطابق evil-colapia.com ولا colapia.com.evil.io.) */
export function isOwnHost(hostname: string, rootDomain: string | undefined | null): boolean {
  const root = normalizeMailDomain(rootDomain);
  const h = String(hostname ?? "").toLowerCase().replace(/\.$/, "");
  return h === root || h === `www.${root}` || h.endsWith(`.${root}`);
}
