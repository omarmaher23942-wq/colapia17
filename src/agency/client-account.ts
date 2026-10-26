import "server-only";
// client-account.ts — حساب العميل في بوابة /dashboard: صف تاجر بالبريد الذي سجّله في الحجز (بلا متجر مستضاف). يدخل به لاحقاً
// بحساب Google أو برمز على بريده (server/auth.ts تطابق البريد القانوني)، فلا كلمة مرور ولا دعوة منفصلة.
import { desc, eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import { merchants } from "@/db/schema";
import { canonicalEmail } from "@/lib/contact";

export async function ensureClientMerchant(input: { email: string; name: string; phone: string | null }): Promise<string> {
  const email = input.email.trim().toLowerCase();
  const canonical = canonicalEmail(email);
  const [found] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(or(eq(merchants.emailCanonical, canonical), eq(merchants.email, email)))
    .orderBy(desc(merchants.createdAt))
    .limit(1);
  if (found) return found.id;
  const [created] = await db
    .insert(merchants)
    .values({ email, emailCanonical: canonical, displayName: input.name.trim().slice(0, 80) || email.split("@")[0] || "عميل", phone: input.phone, isActivated: false })
    .returning({ id: merchants.id });
  if (created) return created.id;
  // سباق نادر: أُنشئ للتو من طلب آخر.
  const [again] = await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.email, email)).limit(1);
  if (!again) throw new Error("client_merchant_failed");
  return again.id;
}
