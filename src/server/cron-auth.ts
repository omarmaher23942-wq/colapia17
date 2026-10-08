import "server-only";
import { Receiver } from "@upstash/qstash";
import { secretsEqual } from "@/server/passwords";

/**
 * مهام الجدولة تُقبل بطريقتين:
 *  1) Vercel Cron أو QStash مع هيدر Authorization: Bearer CRON_SECRET (يُمرَّر عبر Upstash-Forward-Authorization).
 *  2) جداول QStash العادية: موقّعة تلقائياً بهيدر Upstash-Signature، فنتحقق من التوقيع بمفاتيح التوقيع.
 * لا نقبل السر من الرابط (يُسجَّل في سجلات الوصول)، والمقارنة ثابتة الزمن.
 */
export async function isAuthorizedCron(req: Request): Promise<boolean> {
  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (provided && secretsEqual(provided, process.env.CRON_SECRET)) return true;

  const signature = req.headers.get("upstash-signature");
  const current = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const next = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!signature || !current || !next) return false;
  try {
    return await new Receiver({ currentSigningKey: current, nextSigningKey: next }).verify({ signature, body: await req.clone().text() });
  } catch {
    return false;
  }
}
