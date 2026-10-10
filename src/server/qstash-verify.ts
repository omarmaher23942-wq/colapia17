import "server-only";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

type Handler = (req: Request) => Promise<Response>;

/**
 * مثل verifySignatureAppRouter لكن يُنشأ عند أول طلب لا عند تحميل الملف: البناء (next build في Docker)
 * يحمّل كل المسارات بلا أسرار، والنسخة الأصلية ترمي فوراً إن غابت مفاتيح التوقيع.
 */
export function verifiedByQStash(handler: Handler): Handler {
  let wrapped: Handler | null = null;
  return (req) => (wrapped ??= verifySignatureAppRouter(handler) as Handler)(req);
}
