// POST /api/upload/complete — تأكيد رفع إلى R2: يتحقق من التذكرة الموقّعة ومن وجود الملف بنفس الحجم والنوع، ثم
// ينفّذ خطوة ما بعد الرفع (تسجيل ملفات الاستمارة للطلب). ملف لم يُرفع أو اختلف = خطأ.
import { NextResponse } from "next/server";
import { z } from "zod";
import { headObject, publicUrl, r2Configured } from "@/server/r2";
import { afterUpload } from "@/server/upload-policies";
import { readTicket } from "@/server/upload-ticket";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!r2Configured()) return NextResponse.json({ error: "مساحة الملفات غير مضبوطة" }, { status: 503 });
  const p = z.object({ tickets: z.array(z.string()).min(1).max(10) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  const files = [];
  for (const raw of p.data.tickets) {
    const t = readTicket(raw);
    if (!t) return NextResponse.json({ error: "انتهت مهلة الرفع، حاول مرة أخرى." }, { status: 400 });
    const head = await headObject(t.k).catch(() => null);
    if (!head || head.size !== t.s || head.type.split(";")[0] !== t.t) return NextResponse.json({ error: "تعذر التحقق من الملف المرفوع، حاول مرة أخرى." }, { status: 400 });
    const url = publicUrl(t.k);
    await afterUpload(t.r, t.m, { key: t.k, url, type: t.t, size: t.s });
    files.push({ key: t.k, url });
  }
  return NextResponse.json({ files });
}
