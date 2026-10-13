"use server";

// manual-order.ts — «طلب من الشات» (الجولة 3.2): التاجر يسجل طلباً جاءه في رسائل إنستجرام/واتساب/مكالمة، فيدخل مع
// بقية الطلبات (المخزون، المراحل، رسالة التأكيد برابطها، الشحن، التقرير). نفس قواعد تسعير المتجر ومخزونه
// (`server/order-lines.ts`)، مع ما يحتاجه البيع في الشات: سعر خاص للصنف، وشحن يدوي، وخصم بمبلغ، وتحويل استُلم بالفعل.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { customers, orderItems, orders, products, productVariants } from "@/db/schema";
import { storeFor } from "@/server/merchant-guard";
import { getBlueprint } from "@/lib/tenant";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { newOrderCode } from "@/lib/ids";
import { syncVariantTotals } from "@/server/inventory";
import { dbErrorInfo, PG_CHECK, PG_UNIQUE } from "@/lib/db-errors";
import { CHAT_SOURCES, CHAT_SOURCE_LABEL, manualSource } from "@/lib/manual-order";
import { CheckoutError, GOV_CODES, computeShipping, priceLines } from "@/server/order-lines";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; field?: string };

const phone = z.string().transform((v, ctx) => {
  const n = normalizeEgyptianPhone(v);
  if (!n) ctx.addIssue({ code: "custom", message: "رقم موبايل مصري غير صحيح (01xxxxxxxxx)" });
  return n ?? "";
});
const piasters = z.number().int().min(0).max(100_000_000);

const manualSchema = z.object({
  source: z.enum(CHAT_SOURCES),
  name: z.string().trim().min(2, "اكتب اسم العميل").max(60),
  phone,
  altPhone: z
    .string()
    .optional()
    .transform((v) => (v ? normalizeEgyptianPhone(v) ?? undefined : undefined)),
  governorate: z.enum(GOV_CODES, { message: "اختر المحافظة" }),
  city: z.string().trim().max(60).optional(),
  address: z.string().trim().min(5, "اكتب العنوان بالتفصيل (الشارع والعمارة والشقة)").max(300),
  landmark: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(300).optional(),
  paymentMethod: z.enum(["cod", "vodafone_cash", "instapay"]),
  /** للتحويل: وصل المبلغ بالفعل (يُسجَّل الدفع مؤكداً). */
  paid: z.boolean().default(false),
  /** العميل أكّد الطلب في المحادثة: يبدأ «مؤكداً» بدل «جديد». */
  confirmed: z.boolean().default(false),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        qty: z.number().int().min(1).max(50),
        /** سعر خاص للقطعة بالقروش (اتفاق في الشات)؛ غيابه = سعر المتجر. */
        unitPiasters: piasters.optional(),
      })
    )
    .min(1, "أضف منتجاً واحداً على الأقل")
    .max(30),
  /** سعر شحن يدوي بالقروش؛ غيابه = حساب المتجر من جدول الشحن. */
  shippingPiasters: piasters.optional(),
  discountPiasters: piasters.default(0),
});

async function own() {
  const s = await storeFor("orders");
  if (!s) return null;
  return { ...s, db: await getTenantDb(s.storeId) };
}

/** سعر الشحن كما يحسبه المتجر (لعرضه أثناء إدخال الطلب)، أو سبب تعذّره. */
export async function manualShippingQuoteAction(governorate: string, subtotal: number, method: string): Promise<Result<{ fee: number; codExtra: number }>> {
  const s = await own();
  if (!s) return { ok: false, error: "انتهت جلستك، سجّل الدخول من جديد" };
  try {
    const bp = await getBlueprint(s.storeId);
    return { ok: true, data: await computeShipping(s.storeId, bp, governorate, Math.max(0, Math.round(subtotal) || 0), method) };
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, error: "الشحن لهذه المحافظة غير مفعّل في متجرك؛ اكتب سعر الشحن بنفسك.", field: "shipping" };
    return { ok: false, error: "تعذّر حساب الشحن الآن" };
  }
}

export type KnownCustomer = { name: string; governorate: string | null; city: string | null; address: string | null; altPhone: string | null; isBlocked: boolean; delivered: number; returned: number };

/** عميل سابق بنفس الرقم: يملأ بياناته ويعرض سجله (استلم/رفض) قبل الشحن. */
export async function lookupCustomerAction(raw: string): Promise<KnownCustomer | null> {
  const s = await own();
  const p = normalizeEgyptianPhone(raw);
  if (!s || !p) return null;
  const [c] = await s.db
    .select({
      name: customers.name,
      governorate: customers.governorate,
      city: customers.city,
      address: customers.address,
      altPhone: customers.altPhone,
      isBlocked: customers.isBlocked,
      delivered: sql<number>`(select count(*)::int from ${orders} o where o.store_id = ${s.storeId} and o.customer_phone = ${p} and o.is_test = false and o.status = 'delivered')`,
      returned: sql<number>`(select count(*)::int from ${orders} o where o.store_id = ${s.storeId} and o.customer_phone = ${p} and o.is_test = false and o.status = 'returned')`,
    })
    .from(customers)
    .where(and(eq(customers.storeId, s.storeId), eq(customers.phone, p)))
    .limit(1);
  return c ? { ...c, name: c.name ?? "", delivered: Number(c.delivered) || 0, returned: Number(c.returned) || 0 } : null;
}

export async function createManualOrderAction(raw: unknown): Promise<Result<{ id: string; code: string }>> {
  const s = await own();
  if (!s) return { ok: false, error: "انتهت جلستك، أو لا تملك صلاحية إدارة الطلبات" };
  const parsed = manualSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0]!;
    return { ok: false, error: i.message, field: String(i.path[0] ?? "") };
  }
  const input = parsed.data;
  const { db, storeId } = s;

  try {
    const [blocked] = await db
      .select({ b: customers.isBlocked })
      .from(customers)
      .where(and(eq(customers.storeId, storeId), eq(customers.phone, input.phone)))
      .limit(1);
    if (blocked?.b) throw new CheckoutError("هذا الرقم محظور في متجرك. ألغِ الحظر من صفحة العميل إن أردت البيع له.", "phone");

    const { lines } = await priceLines(storeId, input.items);
    // السعر الخاص يُطبَّق على السطر المطابق (المنتج والتركيبة).
    for (const l of lines) {
      const o = input.items.find((i) => i.productId === l.p.id && (i.variantId ?? null) === (l.v?.id ?? null) && i.unitPiasters !== undefined);
      if (o?.unitPiasters !== undefined) {
        l.unit = o.unitPiasters;
        l.total = l.unit * l.qty;
      }
    }
    const subtotal = lines.reduce((a, l) => a + l.total, 0);
    const discount = Math.min(input.discountPiasters, subtotal);
    let ship: { fee: number; codExtra: number };
    if (input.shippingPiasters !== undefined) ship = { fee: input.shippingPiasters, codExtra: 0 };
    else {
      const bp = await getBlueprint(storeId);
      ship = await computeShipping(storeId, bp, input.governorate, subtotal, input.paymentMethod).catch((e) => {
        if (e instanceof CheckoutError) throw new CheckoutError("الشحن لهذه المحافظة غير مفعّل في متجرك؛ اكتب سعر الشحن بنفسك.", "shipping");
        throw e;
      });
    }
    const total = subtotal - discount + ship.fee + ship.codExtra;
    const now = new Date();
    const history: { status: string; at: string; note?: string }[] = [{ status: "new", at: now.toISOString(), note: `سُجّل من الشات (${CHAT_SOURCE_LABEL[input.source]})` }];
    if (input.confirmed) history.push({ status: "confirmed", at: now.toISOString(), note: "أكّده العميل في المحادثة" });
    const paymentStatus = input.paymentMethod === "cod" ? "pending" : input.paid ? "confirmed" : "pending";
    const customerRef = sql`(select ${customers.id} from ${customers} where ${customers.storeId} = ${storeId} and ${customers.phone} = ${input.phone})`;
    const stockLines = lines.filter((l) => l.p.trackStock);
    const variantProducts = [...new Set(stockLines.filter((l) => l.v && l.v.stock !== null).map((l) => l.p.id))];

    for (let attempt = 1; ; attempt++) {
      const id = crypto.randomUUID();
      const code = newOrderCode();
      try {
        await db.batch([
          db
            .insert(customers)
            .values({
              storeId,
              phone: input.phone,
              name: input.name,
              altPhone: input.altPhone,
              governorate: input.governorate,
              city: input.city,
              address: input.address,
              ordersCount: 1,
              totalSpentPiasters: total,
              lastOrderAt: now,
            })
            .onConflictDoUpdate({
              target: [customers.storeId, customers.phone],
              set: {
                name: input.name,
                address: input.address,
                governorate: input.governorate,
                city: input.city,
                altPhone: input.altPhone,
                ordersCount: sql`${customers.ordersCount} + 1`,
                totalSpentPiasters: sql`${customers.totalSpentPiasters} + ${total}`,
                lastOrderAt: now,
                updatedAt: now,
              },
            }),
          db.insert(orders).values({
            id,
            storeId,
            customerId: customerRef,
            code,
            customerName: input.name,
            customerPhone: input.phone,
            customerAltPhone: input.altPhone,
            governorate: input.governorate,
            city: input.city,
            address: input.address,
            landmark: input.landmark,
            customerNotes: input.notes,
            subtotalPiasters: subtotal,
            shippingPiasters: ship.fee,
            codFeePiasters: ship.codExtra,
            discountPiasters: discount,
            totalPiasters: total,
            paymentMethod: input.paymentMethod,
            paymentStatus,
            status: input.confirmed ? "confirmed" : "new",
            statusHistory: history,
            source: manualSource(input.source),
          }),
          db.insert(orderItems).values(
            lines.map((l) => ({
              orderId: id,
              storeId,
              productId: l.p.id,
              variantId: l.v?.id,
              name: l.p.name,
              variantLabel: l.v?.optionValues.join(" / "),
              imageUrl: l.v?.imageUrl ?? l.p.images[0]?.url,
              unitPiasters: l.unit,
              quantity: l.qty,
              totalPiasters: l.total,
            }))
          ),
          ...lines.map((l) =>
            db
              .update(products)
              .set({
                orderCount: sql`${products.orderCount} + ${l.qty}`,
                ...(l.p.trackStock && !l.v && l.p.stock !== null ? { stock: sql`${products.stock} - ${l.qty}` } : {}),
              })
              .where(and(eq(products.id, l.p.id), eq(products.storeId, storeId)))
          ),
          ...stockLines
            .filter((l) => l.v && l.v.stock !== null)
            .map((l) => db.update(productVariants).set({ stock: sql`${productVariants.stock} - ${l.qty}` }).where(and(eq(productVariants.id, l.v!.id), eq(productVariants.storeId, storeId)))),
          ...(variantProducts.length ? [syncVariantTotals(db, storeId, variantProducts)] : []),
        ]);
        revalidatePath("/dashboard/orders");
        return { ok: true, data: { id, code } };
      } catch (e) {
        const info = dbErrorInfo(e);
        if (info.code === PG_UNIQUE && info.constraint?.includes("orders_store_code_uq") && attempt < 3) continue;
        if (info.code === PG_CHECK && info.constraint?.includes("stock")) throw new CheckoutError("نفدت كمية أحد المنتجات قبل حفظ الطلب بلحظات. راجع الكميات.");
        throw e;
      }
    }
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, error: e.message, field: e.field };
    console.error("[manual-order] create failed:", e);
    return { ok: false, error: "تعذّر حفظ الطلب الآن، حاول مرة أخرى" };
  }
}
