import "server-only";
// tokens.ts — روابط الفريق السرية للتاجر، موقّعة بـ HMAC من سر المنصة وتُعاد توليدها دون تخزين (lib/link-token.ts):
//  - رابط الإعداد /setup/<رمز> (14 يوماً): يضع فيه صاحب المتجر كلمة مروره لأول مرة ثم يدخل الإعداد.
//  - رابط إعادة التعيين /login/reset/<رمز> (يومان، لمرة واحدة): يولّده الفريق لمن تعذّر عليه البريد.
import { env } from "@/lib/env";
import { issueLinkToken } from "@/lib/link-token";

const origin = () => {
  const root = (env.ROOT_DOMAIN || "").trim();
  return !root || root.startsWith("localhost") ? "http://localhost:3100" : `https://${root}`;
};

/** رابط الإعداد الذي يصل التاجر (المنصة على النطاق الرئيسي، لا على نطاق المتجر). */
export const setupLink = (storeId: string, now = Date.now()) => `${origin()}/setup/${issueLinkToken(env.AUTH_SECRET, "setup", storeId, { now })}`;

/** رابط إعادة تعيين كلمة المرور: يبطل بمجرد تغيير كلمة المرور (البصمة من تجزئتها الحالية). */
export const resetLink = (merchantId: string, fp: string, now = Date.now()) => `${origin()}/login/reset/${issueLinkToken(env.AUTH_SECRET, "reset", merchantId, { now, fp })}`;
