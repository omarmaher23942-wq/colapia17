// POST /api/golden/submit — إرسال الحجز: التحقق ← السعر الحالي من الخادم ← إيصال من ملفات الحجز نفسه ← حجز بانتظار تأكيد المالك.
// السعر لا يأتي من المتصفح أبداً: يُحسب هنا من الأسعار الحالية ومقاعد الدائرة الذهبية، والمتصفح يرسل العرض الذي رآه فقط
// ليُرفض الإرسال (409) إن تغيّر قبل أن يدفع العميل المبلغ الخطأ.
import { after } from "next/server";
import { bookingEnabled, checkFillTicket, isTeamEmail, json, limits, sameOrigin } from "@/golden/guard";
import { draftIsOpen, findByDraftToken, findOpenBooking, receiptByKey, submitBooking } from "@/golden/repo";
import { isReceiptKey, validateBooking } from "@/golden/schema";
import { derivedToken, hashIp } from "@/golden/tokens";
import { notifyBookingSubmitted } from "@/golden/notify";
import { clientIp } from "@/lib/client-ip";
import { currentProjectQuote } from "@/server/pricing";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BODY = 40_000;

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "طلب غير مقبول." }, 403);
  if (!(await bookingEnabled())) return json({ error: "استقبال الحجوزات متوقف مؤقتاً. حاولوا لاحقاً." }, 503);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return json({ error: "الطلب كبير." }, 413);
  if (!(await limits.submit(req))) return json({ error: "محاولات كثيرة. انتظروا قليلاً ثم أعيدوا المحاولة." }, 429);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return json({ error: "طلب غير صالح." }, 400);

  // فخ البرامج الآلية: حقل مخفي يملؤه الآلي فقط (قبول صامت بلا حجز)، وزمن ملء أسرع من البشر.
  if (typeof body.website === "string" && body.website.trim()) return json({ ok: true, next: "/golden" });
  const ticket = checkFillTicket(body.st);
  if (ticket === "invalid" || ticket === "expired") return json({ error: "انتهت صلاحية الصفحة. حدّثوها ثم أرسلوا مرة أخرى.", reload: true }, 400);
  if (ticket === "too_fast") return json({ error: "أرسلوا الحجز مرة أخرى بعد لحظات.", retry: true }, 425);

  const row = await findByDraftToken(body.t);
  if (!row) return json({ error: "رابط الحجز غير صالح. افتحوا الصفحة من جديد.", reload: true }, 404);
  if (row.status !== "draft") {
    // أُرسل سابقاً (إعادة محاولة بعد انقطاع الشبكة): نعيد رابط المتابعة نفسه دون حجز ثانٍ.
    return json({ ok: true, next: `/golden/done/${derivedToken("track", row.id)}` });
  }
  if (!draftIsOpen(row)) return json({ error: "انتهت صلاحية الصفحة. افتحوها من جديد.", reload: true }, 410);

  const quote = await currentProjectQuote();
  if (body.expectedOffer !== quote.offer) {
    return json(
      {
        error:
          quote.offer === "standard"
            ? `اكتملت مقاعد العرض الخاص للتو، والسعر الحالي ${quote.regularPrice.toLocaleString("en-US")} ج. حدّثوا الصفحة قبل التحويل، وإن حوّلتم بالفعل راسلونا لنتصرف معكم بأمانة.`
            : "تغيّر العرض المتاح. حدّثوا الصفحة قبل التحويل.",
        reload: true,
        offer: quote.offer,
      },
      409
    );
  }

  const receipt = isReceiptKey(body.receiptKey) ? await receiptByKey(row.id, body.receiptKey) : null;
  const check = validateBooking(body, { offer: quote.offer, hasReceipt: Boolean(receipt) });
  if (!check.ok) return json({ error: check.error, field: check.field }, 422);

  const email = check.data.contact.email;
  if (!isTeamEmail(email)) {
    if (!(await limits.email(email))) return json({ error: "وصلتنا محاولات كثيرة بهذا البريد. حاولوا لاحقاً أو راسلونا." }, 429);
    const open = await findOpenBooking(email, row.id);
    if (open) return json({ error: "لديكم حجز بانتظار التأكيد بهذا البريد بالفعل. سنراسلكم فور تأكيده، وإن احتجتم تعديلاً راسلونا." }, 409);
  }

  const amountEgp = quote.price;
  const out = await submitBooking({ row, data: check.data, offer: quote.offer, amountEgp, receiptUrl: receipt!.url, ipHash: hashIp(clientIp(req.headers)) });
  if (!out.ok) {
    return json({ error: out.reason === "duplicate_payment" ? "لديكم إيصال قيد المراجعة بالفعل." : "انتهت صلاحية الصفحة. افتحوها من جديد.", reload: out.reason === "closed" }, 409);
  }
  after(() => notifyBookingSubmitted({ requestId: out.requestId, paymentId: out.paymentId, code: out.code, trackToken: out.trackToken, data: check.data, offer: quote.offer, amountEgp, receiptUrl: receipt!.url }));
  return json({ ok: true, next: `/golden/done/${out.trackToken}` });
}
