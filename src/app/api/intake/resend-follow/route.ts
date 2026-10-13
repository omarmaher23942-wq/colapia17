// POST /api/intake/resend-follow — من حاول إرسال استمارة وحجبه «عندنا طلب مفتوح بنفس البريد»: نرسل رابط متابعة الطلب
// المفتوح إلى البريد المسجّل عليه فقط (لا نكشف الرابط في الرد، ولا نؤكد وجود طلب لمن لا يملك البريد). الرد واحد دائماً.
import { findByDraftToken, readData } from "@/intake/repo";
import { emailKey, findOpenRequest, hit, json, requestIp, sameOrigin } from "@/intake/guard";
import { canonicalEmail, normalizeEmail } from "@/intake/schema";
import { sendFollowLink } from "@/intake/notify";
import { readJson } from "@/intake/http";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const OK = () => json({ ok: true, message: "لو في طلب مفتوح على بريدك، هيوصلك رابط المتابعة خلال دقيقة. شوف الرسائل غير المرغوبة كمان." });

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
  const ip = requestIp(req);
  if (!(await hit(`resend:ip:${ip}`, 8, 3600))) return json({ error: "rate_limited", message: "محاولات كتير، جرّب بعد شوية." }, 429);
  const parsed = await readJson(req);
  if (!parsed.ok) return json({ error: "bad_request" }, parsed.status);
  try {
    const row = await findByDraftToken(parsed.body.token);
    const email = row ? normalizeEmail(readData(row.data).contact.email) : null;
    if (!row || !email) return OK();
    if (!(await hit(`resend:email:${emailKey(email)}`, 3, 86_400))) return OK();
    const open = await findOpenRequest({ email, whatsapp: null, excludeId: row.id });
    if (open?.email && canonicalEmail(open.email) === canonicalEmail(email)) await sendFollowLink(open);
  } catch (e) {
    console.error("[intake/resend-follow]", e);
  }
  return OK();
}
