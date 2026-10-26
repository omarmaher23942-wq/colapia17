"use server";
// actions.ts — إجراءات صفحة المتابعة العامة. «أرسلوا إيصالاً جديداً» بعد رفض إيصال: يعيد فتح الحجز مسودةً برابط جديد
// (أو برابط المحادثة المشتق إن كان من الوكيل) وببياناته السابقة، فلا يعيد العميل الكتابة. الإجراء يملكه من يملك رابط المتابعة.
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { platformPayments, storeRequests } from "@/db/schema";
import { hit } from "@/lib/rate-hit";
import { headers } from "next/headers";
import { clientIp, ipBucket } from "@/lib/client-ip";
import { DRAFT_TTL_DAYS, findByTrackToken } from "./repo";
import { fieldsOf } from "./schema";
import { derivedToken, hashToken, randomToken } from "./tokens";

type Result = { ok: true; next: string } | { ok: false; error: string };

export async function reopenBookingAction(trackToken: string): Promise<Result> {
  const h = await headers();
  if (!(await hit(`golden:reopen:${ipBucket(clientIp(h))}`, 10, 3600))) return { ok: false, error: "محاولات كثيرة. انتظروا قليلاً." };
  const row = await findByTrackToken(trackToken);
  if (!row || row.status !== "awaiting_payment") return { ok: false, error: "لا يمكن إعادة فتح هذا الطلب." };
  const [last] = await db.select({ status: platformPayments.status }).from(platformPayments).where(eq(platformPayments.requestId, row.id)).orderBy(sql`${platformPayments.createdAt} desc`).limit(1);
  if (last?.status !== "rejected") return { ok: false, error: "الإيصال الحالي قيد المراجعة أو مقبول." };

  // الطلب القادم من محادثة يعود لرابطها المشتق (فلا يتكرر حجز للمحادثة نفسها)، والباقي برابط عشوائي جديد.
  const token = row.conversationId ? derivedToken("conversation", row.conversationId) : randomToken();
  const [done] = await db
    .update(storeRequests)
    .set({
      status: "draft",
      draftTokenHash: hashToken(token),
      data: { v: 2, prefill: fieldsOf(row.data) } as unknown as Record<string, unknown>,
      submittedAt: null,
      expiresAt: sql`now() + make_interval(days => ${DRAFT_TTL_DAYS})`,
      updatedAt: new Date(),
    })
    .where(and(eq(storeRequests.id, row.id), eq(storeRequests.status, "awaiting_payment")))
    .returning({ id: storeRequests.id });
  if (!done) return { ok: false, error: "تغيّرت حالة الطلب. حدّثوا الصفحة." };
  return { ok: true, next: `/golden?c=${token}` };
}
