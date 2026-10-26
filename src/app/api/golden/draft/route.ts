// POST /api/golden/draft — يصدر رمز مسودة لزائر الويب عند أول حاجة للرفع (الإيصال). لا يُنشأ شيء عند فتح الصفحة نفسها،
// فلا تُملأ القاعدة بمسودات من زيارات عابرة. الحماية: نفس المصدر، مفتاح الإيقاف، حد معدل لكل شبكة.
import { bookingEnabled, json, limits, sameOrigin } from "@/golden/guard";
import { createDraft } from "@/golden/repo";
import { hashIp } from "@/golden/tokens";
import { clientIp } from "@/lib/client-ip";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "طلب غير مقبول." }, 403);
  if (!(await bookingEnabled())) return json({ error: "استقبال الحجوزات متوقف مؤقتاً. حاولوا لاحقاً." }, 503);
  if (!(await limits.draft(req))) return json({ error: "محاولات كثيرة. انتظروا قليلاً ثم أعيدوا المحاولة." }, 429);
  try {
    const { token } = await createDraft({ source: "web", ipHash: hashIp(clientIp(req.headers)), userAgent: req.headers.get("user-agent") });
    return json({ token });
  } catch (e) {
    console.error("[golden/draft] failed", e);
    return json({ error: "تعذر بدء الحجز. حاولوا مرة أخرى." }, 500);
  }
}
