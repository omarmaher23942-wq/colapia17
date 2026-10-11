"use server";
// order-confirm.ts — العميل يؤكد طلبه أو يلغيه من رابط «أكّد طلبك» الموقّع الذي يرسله التاجر على واتساب.
// يعمل فقط والطلب «جديد» (قبل أن يبدأ التاجر التجهيز)، ويُسجَّل في سجل الطلب بصوت العميل، وتظهر النتيجة للتاجر فوراً.
// التأكيد لا يدفع شيئاً ولا يمس المخزون؛ الإلغاء يعيد الكمية كأي إلغاء.
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { orders } from "@/db/schema";
import { allow, clientIp } from "@/lib/ratelimit";
import { getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";
import { validConfirmToken } from "@/lib/order-access";
import { applyOrderStatus } from "@/server/order-status-change";

const schema = z.object({
  subdomain: z.string().min(1).max(63),
  code: z.string().trim().toUpperCase().min(3).max(20),
  token: z.string().min(10).max(64),
  decision: z.enum(["confirm", "cancel"]),
  reason: z.string().trim().max(300).optional(),
});

export type ConfirmResult = { ok: true; status: "confirmed" | "cancelled" } | { ok: false; error: string };

export async function customerOrderDecisionAction(raw: z.input<typeof schema>): Promise<ConfirmResult> {
  const p = schema.safeParse(raw);
  if (!p.success) return { ok: false, error: "الرابط غير صالح" };
  const d = p.data;
  if (!(await allow("track", `confirm:${clientIp(await headers())}`))) return { ok: false, error: "محاولات كثيرة، حاول بعد دقائق" };

  const store = await getStoreBySubdomain(d.subdomain);
  if (!store || !isStorePubliclyVisible(store)) return { ok: false, error: "المتجر غير متاح الآن" };
  const db = await getTenantDb(store.id);
  const [o] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(and(eq(orders.storeId, store.id), eq(orders.code, d.code)))
    .limit(1);
  if (!o || !validConfirmToken(store.id, o.id, d.token)) return { ok: false, error: "الرابط غير صالح. اطلب من المتجر رابطاً جديداً" };
  if (o.status !== "new") {
    if (d.decision === "confirm" && o.status !== "cancelled" && o.status !== "returned") return { ok: true, status: "confirmed" };
    return { ok: false, error: o.status === "cancelled" ? "هذا الطلب ملغي بالفعل" : "بدأ المتجر تجهيز طلبك، تواصل معهم مباشرة لأي تغيير" };
  }

  const note =
    d.decision === "confirm" ? "أكّده العميل من رابط التأكيد" : `ألغاه العميل من رابط التأكيد${d.reason ? `: ${d.reason.replace(/\s+/g, " ")}` : ""}`;
  const status = d.decision === "confirm" ? "confirmed" : "cancelled";
  const r = await applyOrderStatus({ db, storeId: store.id, subdomain: store.subdomain, actor: "customer:confirm-link" }, o.id, status, note);
  return r.ok ? { ok: true, status } : r;
}
