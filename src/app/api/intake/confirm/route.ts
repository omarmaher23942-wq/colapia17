// تأكيد بريد العميل (رابط في بريد استلام الطلب). البريد المؤكد هو حساب دخول لوحة المتجر لاحقاً.
//
// GET لا يغيّر شيئاً: فاحصو الروابط في صناديق البريد وكاشفات المعاينة يفتحون كل رابط تلقائياً، ولو أكّد GET لأصبحت
// «مؤكد» في اللوحة بلا أن يفتحه صاحب البريد. لذلك GET يعرض صفحة بزر «تأكيد البريد» يرسل POST، والتأكيد هناك فقط.
import { NextResponse } from "next/server";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { storeRequestEvents, storeRequests } from "@/db/schema/agency";
import { derivedToken, derivedTokenMatches } from "@/intake/tokens";
import { clientEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const base = () => clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** صفحة بسيطة مستقلة (بلا سكربت ولا موارد خارجية) بنفس هوية المنصة الداكنة. */
function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>${esc(title)} | Colapia</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:#07091a;color:#eef1ff;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif;line-height:1.7}
main{max-width:420px;width:100%;border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:28px;background:#0b0f2a;text-align:center}
h1{font-size:20px;margin:0 0 8px}p{margin:0 0 20px;color:#c3cdf0;font-size:15px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 24px;border:0;border-radius:14px;background:#6f86ff;color:#07091a;font-weight:800;font-size:16px;text-decoration:none;cursor:pointer;font-family:inherit}
</style></head><body><main>${body}</main></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

const invalid = () =>
  page(
    "رابط غير صالح",
    `<h1>الرابط ده مش صالح</h1><p>ممكن يكون اتستخدم قبل كده أو اتقطع جزء منه. لو لسه عايز تأكّد بريدك كلّمنا وهنساعدك.</p><a class="btn" href="${esc(base())}/start">ارجع للاستمارة</a>`,
    400,
  );

function parse(url: URL) {
  const id = url.searchParams.get("r") ?? "";
  const token = url.searchParams.get("t");
  return UUID_RE.test(id) && derivedTokenMatches("confirm", id, token) ? { id, token: token as string } : null;
}

export async function GET(req: Request) {
  const p = parse(new URL(req.url));
  if (!p) return invalid();
  return page(
    "تأكيد البريد",
    `<h1>تأكيد البريد</h1><p>اضغطوا الزر لنتأكد أن هذا البريد يخصكم.</p><form method="post" action="${esc(base())}/api/intake/confirm?r=${esc(p.id)}&amp;t=${esc(p.token)}"><button class="btn" type="submit">تأكيد البريد</button></form>`,
  );
}

export async function POST(req: Request) {
  const p = parse(new URL(req.url));
  if (!p) return invalid();
  try {
    const [done] = await db
      .update(storeRequests)
      .set({ emailConfirmedAt: new Date() })
      .where(and(eq(storeRequests.id, p.id), isNotNull(storeRequests.email), isNull(storeRequests.emailConfirmedAt)))
      .returning({ id: storeRequests.id });
    if (done) await db.insert(storeRequestEvents).values({ requestId: p.id, type: "note", internalNote: "العميل أكّد بريده", actor: "client" });
  } catch (e) {
    console.error("[intake/confirm]", e);
    return page("تعذر التأكيد", `<h1>حدث خطأ مؤقت</h1><p>أعيدوا المحاولة بعد قليل من الرابط نفسه.</p>`, 500);
  }
  return NextResponse.redirect(`${base()}/follow/${derivedToken("track", p.id)}?confirmed=1`, 303);
}
