import "server-only";
// email-log.ts — سجل البريد المُرسل وحالته (V3: D13، A7) من system_events: ما يكتبه lib/email.ts لكل رسالة (scope «email»)،
// والسجلات الأقدم (scope «ops» بمعرّف المتجر داخل data). للمالك في صفحة المتجر ومركز الجاهزية.
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { systemEvents } from "@/db/schema";

export type EmailLogRow = {
  id: string;
  at: Date;
  ok: boolean;
  subject: string;
  to: string[];
  from: string | null;
  status: number | null;
  error: string | null;
  storeId: string | null;
};

const SUBJECT_RE = /^email_(sent|failed):\s*/;

export async function emailLog(opts: { storeId?: string; limit?: number; failedOnly?: boolean } = {}): Promise<EmailLogRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 200);
  const isEmail = and(inArray(systemEvents.scope, ["email", "ops"]), like(systemEvents.message, "email_%"));
  const byStore = opts.storeId ? or(eq(systemEvents.storeId, opts.storeId), sql`${systemEvents.data}->>'storeId' = ${opts.storeId}`) : undefined;
  const failed = opts.failedOnly ? like(systemEvents.message, "email_failed%") : undefined;
  const rows = await db
    .select({ id: systemEvents.id, at: systemEvents.createdAt, message: systemEvents.message, data: systemEvents.data, storeId: systemEvents.storeId })
    .from(systemEvents)
    .where(and(isEmail, byStore, failed))
    .orderBy(desc(systemEvents.createdAt))
    .limit(limit)
    .catch(() => []);
  return rows.map((r) => {
    const d = (r.data ?? {}) as Record<string, unknown>;
    const to = Array.isArray(d.to) ? d.to.map(String) : typeof d.to === "string" ? [d.to] : [];
    return {
      id: r.id,
      at: r.at,
      ok: r.message.startsWith("email_sent"),
      subject: typeof d.subject === "string" ? d.subject : r.message.replace(SUBJECT_RE, ""),
      to,
      from: typeof d.from === "string" ? d.from : null,
      status: typeof d.status === "number" ? d.status : null,
      error: typeof d.error === "string" ? d.error : null,
      storeId: r.storeId ?? (typeof d.storeId === "string" ? d.storeId : null),
    };
  });
}
