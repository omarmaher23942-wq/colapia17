import "server-only";
// notify.ts — بريد داخلي لأعضاء فريق الوكالة (إسناد، إرسال للمراجعة، إعادة للبناء، تأخر). فشل البريد لا يُفشل الإجراء.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { platformUsers } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { clientEnv } from "@/lib/env";

export const requestAdminUrl = (id: string) => new URL(`/admin/requests/${id}`, clientEnv.NEXT_PUBLIC_APP_URL).toString();

export async function emailMembers(ids: (string | null | undefined)[], msg: { subject: string; headline: string; lines: string[]; requestId: string; href?: string }): Promise<number> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!unique.length) return 0;
  const rows = await db
    .select({ email: platformUsers.email })
    .from(platformUsers)
    .where(and(inArray(platformUsers.id, unique), eq(platformUsers.isActive, true)))
    .catch(() => []);
  let sent = 0;
  for (const r of rows) {
    const ok = await sendEmail({
      to: r.email,
      subject: msg.subject,
      headline: msg.headline,
      paragraphs: msg.lines,
      buttons: [{ title: "افتح الطلب", url: msg.href ?? requestAdminUrl(msg.requestId) }],
    }).catch(() => false);
    if (ok) sent++;
  }
  return sent;
}

/** المالكون والمديرون النشطون (لتنبيهات التأخر وما يحتاج قرار إدارة). */
export async function managerIds(): Promise<string[]> {
  const rows = await db
    .select({ id: platformUsers.id })
    .from(platformUsers)
    .where(and(eq(platformUsers.isActive, true), inArray(platformUsers.role, ["owner", "admin"])))
    .catch(() => []);
  return rows.map((r) => r.id);
}
