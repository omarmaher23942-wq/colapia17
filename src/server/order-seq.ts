import "server-only";
// order-seq.ts — رقم الطلب التالي من تسلسل المتجر (جدول المنصة): زيادة ذرية في جملة واحدة (UPDATE ... RETURNING)،
// فلا يتكرر رقم تحت الضغط. الفجوات عند فشل الحفظ مقبولة؛ الفريد (store_id, code) يحمي من التكرار.
import { eq, sql } from "drizzle-orm";
import { db as platformDb } from "@/db/client";
import { stores } from "@/db/schema";
import { formatOrderCode } from "@/lib/order-code";

export async function nextOrderCode(storeId: string, prefix: unknown): Promise<string> {
  const [row] = await platformDb
    .update(stores)
    .set({ orderSeq: sql`${stores.orderSeq} + 1` })
    .where(eq(stores.id, storeId))
    .returning({ seq: stores.orderSeq });
  if (!row) throw new Error("store missing");
  return formatOrderCode(prefix, row.seq);
}
