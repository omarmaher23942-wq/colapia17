"use server";

import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import {
  getStoreBySubdomain,
  getBlueprint,
  isStorePubliclyVisible,
} from "@/lib/tenant";
import { allow, clientIp } from "@/lib/ratelimit";
import { redis } from "@/lib/redis";
import { db as platformDb } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import {
  orders,
  orderItems,
  customers,
  products,
  productVariants,
  discounts,
  abandonedCarts,
  merchants,
} from "@/db/schema";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { governorateName } from "@/lib/egypt";
import { formatEgp } from "@/lib/money";
import { clientEnv } from "@/lib/env";
import { ensureDeviceId, grantOrderAccess, hasOrderAccess } from "@/lib/order-access";
import {
  sendMerchantNewOrderEmail,
} from "@/lib/email";
import { storeUrl } from "@/lib/utils";
import { cleanMetaPixel } from "@/lib/tracking";
import { CAMPAIGN_COOKIE, orderSourceFrom } from "@/lib/campaigns";
import { metaCapiToken } from "@/server/store-secrets";
import { sendCapiPurchase } from "@/server/meta-capi";
import { newOrderCode } from "@/lib/ids";
import { phoneOrderBlock } from "@/lib/order-spam";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";
import {
  emitOrderCreated,
  emitCartAbandoned,
} from "@/server/realtime/emitters";
import { syncVariantTotals } from "@/server/inventory";
import { getMerchantSession } from "@/server/auth";
import { hostingServes, hostingState } from "@/lib/hosting";
import { dbErrorInfo, PG_CHECK, PG_UNIQUE } from "@/lib/db-errors";
import { CheckoutError, GOV_CODES, isGovernorate, cartItemsSchema, computeShipping, priceLines, validateDiscount } from "@/server/order-lines";


export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

export type Quote =
  | {
      ok: true;
      subtotal: number;
      shipping: number | null;
      codFee: number;
      discount: number;
      total: number;
      discountError?: string;
      shippingError?: string;
    }
  | { ok: false; error: string };

const GENERIC_ERROR = "حدث خطأ أثناء تنفيذ طلبك، يرجى المحاولة ثانية";
const IDEM_TTL_S = 900;
const ORDER_CODE_ATTEMPTS = 3;



const checkoutSchema = z.object({
  name: z.string().trim().min(2, "اكتب اسمك الثلاثي").max(60),
  phone: z.string().transform((v, ctx) => {
    const n = normalizeEgyptianPhone(v);
    if (!n)
      ctx.addIssue({
        code: "custom",
        message: "رقم موبايل مصري غير صحيح (01xxxxxxxxx)",
      });
    return n ?? "";
  }),
  email: z.string().email("بريد إلكتروني غير صحيح").optional().or(z.literal("")),
  altPhone: z
    .string()
    .optional()
    .transform((v) =>
      v ? normalizeEgyptianPhone(v) ?? undefined : undefined
    ),
  governorate: z.enum(GOV_CODES, { message: "اختر المحافظة" }),
  city: z.string().trim().max(60).optional(),
  address: z
    .string()
    .trim()
    .min(5, "اكتب اسم الشارع ورقم العمارة والشقة")
    .max(300),
  landmark: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(300).optional(),
  paymentMethod: z.enum(["cod", "vodafone_cash", "instapay"]),
  discountCode: z.string().trim().toUpperCase().max(20).optional(),
  transferSenderPhone: z.string().max(30).optional(),
  transferScreenshotUrl: z
    .string()
    .max(500)
    .refine(isTrustedUploadUrl, "رابط صورة التحويل غير صالح")
    .optional(),
  items: cartItemsSchema,
  visitorId: z.string().max(64).optional(),
  idempotencyKey: z.string().min(8).max(64).optional(),
});

type Done = { code: string; total: number };

async function ip() {
  return clientIp(await headers());
}





export async function placeOrderAction(
  subdomain: string,
  raw: unknown
): Promise<ActionResult<Done>> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]!.message,
      field: String(parsed.error.issues[0]!.path[0] ?? ""),
    };
  }
  const input = parsed.data;

  const store = await getStoreBySubdomain(subdomain);
  if (!store || !isStorePubliclyVisible(store) || !hostingServes(hostingState(store)))
    return { ok: false, error: "المتجر لا يستقبل طلبات حالياً" };
  const db = await getTenantDb(store.id);
  if (!store.acceptingOrders)
    return {
      ok: false,
      error: store.vacationMessage || "المتجر متوقف مؤقتاً عن استقبال الطلبات",
    };

  const idemKey = input.idempotencyKey
    ? `idem:order:${store.id}:${input.idempotencyKey}`
    : null;
  if (idemKey) {
    let claimed = true;
    try {
      claimed = !!(await redis.set(idemKey, "pending", {
        nx: true,
        ex: IDEM_TTL_S,
      }));
    } catch {
      claimed = true;
    }
    if (!claimed) {
      const prev = await redis.get<Done | string>(idemKey).catch(() => null);
      if (
        prev &&
        typeof prev === "object" &&
        typeof (prev as Done).code === "string"
      ) {
        await grantOrderAccess(store.id, (prev as Done).code);
        return { ok: true, data: prev as Done };
      }
      return {
        ok: false,
        error: "طلبك قيد التنفيذ، يرجى الانتظار ثواني",
      };
    }
  }

  const release = async () => {
    if (idemKey) await redis.del(idemKey).catch(() => {});
  };

  if (!(await allow("checkout", await ip()))) {
    await release();
    return { ok: false, error: "محاولات كثيرة في وقت قصير، انتظر دقائق" };
  }

  try {
    const bp = await getBlueprint(store.id);
    const pm = bp.payments;
    if (
      (input.paymentMethod === "cod" && !pm.cod.enabled) ||
      (input.paymentMethod === "vodafone_cash" &&
        !pm.vodafoneCash.enabled) ||
      (input.paymentMethod === "instapay" && !pm.instapay.enabled)
    ) {
      throw new CheckoutError("وسيلة الدفع المختارة غير متاحة", "paymentMethod");
    }

    const { lines, subtotal } = await priceLines(store.id, input.items, bp);

    const [existingCustomer] = await db
      .select({ isBlocked: customers.isBlocked })
      .from(customers)
      .where(
        and(
          eq(customers.storeId, store.id),
          eq(customers.phone, input.phone)
        )
      )
      .limit(1);

    if (existingCustomer?.isBlocked) {
      throw new CheckoutError(
        "عذراً، تعذر إتمام الطلب، تواصل مع المتجر مباشرة"
      );
    }

    let discountAmount = 0;
    let discountCode: string | undefined;
    let discountId: string | undefined;
    let freeShip = false;

    if (input.discountCode) {
      const r = await validateDiscount(
        store.id,
        input.discountCode,
        subtotal,
        input.phone
      );
      if ("error" in r)
        throw new CheckoutError(
          r.error ?? "كود الخصم غير صالح",
          "discountCode"
        );
      discountAmount = r.amount;
      discountCode = r.discount.code;
      discountId = r.discount.id;
      freeShip = r.freeShipping;
    }

    const ship = freeShip
      ? { fee: 0, codExtra: 0 }
      : await computeShipping(
          store.id,
          bp,
          input.governorate,
          subtotal,
          input.paymentMethod
        );
    const total =
      Math.max(0, subtotal - discountAmount) + ship.fee + ship.codExtra;
    const now = new Date();
    // الطلب يُحفظ بجهاز العميل: يجده في «طلباتي» على نفس الجهاز دون حساب ولا رقم طلب.
    const deviceId = await ensureDeviceId(store.id);
    // طلب صاحب المتجر من متجره (تجربة الشراء) = طلب تجريبي: يظهر في لوحته بشارة «تجريبي»، ولا يخصم المخزون ولا
    // يُحسب في المبيعات ولا في عدد طلبات العميل والمنتج ولا في استخدام كود الخصم.
    const owner = await getMerchantSession().catch(() => null);
    const isTest = Boolean(owner?.stores.some((x) => x.id === store.id));
    const counted = isTest ? 0 : 1;
    if (!isTest) {
      // حماية من الطلبات الوهمية المتكررة بنفس الرقم (lib/order-spam.ts).
      const [c] = await db
        .select({
          open: sql<number>`count(*) filter (where ${orders.status} in ('new','confirmed'))::int`,
          lastDay: sql<number>`count(*) filter (where ${orders.createdAt} > now() - interval '24 hours')::int`,
        })
        .from(orders)
        .where(and(eq(orders.storeId, store.id), eq(orders.customerPhone, input.phone), eq(orders.isTest, false)));
      const blocked = phoneOrderBlock({ open: Number(c?.open ?? 0), lastDay: Number(c?.lastDay ?? 0) });
      if (blocked) throw new CheckoutError(blocked, "phone");
    }
    const customerRef =
      sql`(select ${customers.id} from ${customers} where ${customers.storeId} = ${store.id} and ${customers.phone} = ${input.phone})`;

    let orderId = "";
    let code = "";

    for (let attempt = 1; ; attempt++) {
      orderId = crypto.randomUUID();
      code = newOrderCode();

      try {
        const stockLines = isTest ? [] : lines.filter((l) => l.p.trackStock);
        const variantProducts = [...new Set(stockLines.filter((l) => l.v && l.v.stock !== null).map((l) => l.p.id))];
        await db.batch([
          db
            .insert(customers)
            .values({
              storeId: store.id,
              phone: input.phone,
              name: input.name,
              email: input.email || null,
              altPhone: input.altPhone,
              governorate: input.governorate,
              city: input.city,
              address: input.address,
              ordersCount: counted,
              totalSpentPiasters: total * counted,
              lastOrderAt: now,
            })
            .onConflictDoUpdate({
              target: [customers.storeId, customers.phone],
              set: {
                name: input.name,
                email: input.email || null,
                address: input.address,
                governorate: input.governorate,
                city: input.city,
                altPhone: input.altPhone,
                ordersCount: sql`${customers.ordersCount} + ${counted}`,
                totalSpentPiasters: sql`${customers.totalSpentPiasters} + ${total * counted}`,
                lastOrderAt: now,
                updatedAt: now,
              },
            }),

          db.insert(orders).values({
            id: orderId,
            storeId: store.id,
            customerId: customerRef,
            code,
            customerName: input.name,
            customerPhone: input.phone,
            customerEmail: input.email || null,
            customerAltPhone: input.altPhone,
            governorate: input.governorate,
            city: input.city,
            address: input.address,
            landmark: input.landmark,
            customerNotes: input.notes,
            subtotalPiasters: subtotal,
            shippingPiasters: ship.fee,
            codFeePiasters: ship.codExtra,
            discountPiasters: discountAmount,
            discountCode,
            totalPiasters: total,
            paymentMethod: input.paymentMethod,
            paymentStatus:
              input.paymentMethod === "cod" ? "pending" : "under_review",
            transferSenderPhone: input.transferSenderPhone || null,
            transferScreenshotUrl: input.transferScreenshotUrl || null,
            statusHistory: [{ status: "new", at: now.toISOString() }],
            source: orderSourceFrom((await cookies()).get(CAMPAIGN_COOKIE)?.value, bp.campaigns),
            visitorId: deviceId,
            idempotencyKey: input.idempotencyKey,
            isTest,
          }),

          db.insert(orderItems).values(
            lines.map((l) => ({
              orderId,
              storeId: store.id,
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

          ...(isTest ? [] : lines).map((l) =>
            db
              .update(products)
              .set({
                orderCount: sql`${products.orderCount} + ${l.qty}`,
                ...(l.p.trackStock && !l.v && l.p.stock !== null
                  ? { stock: sql`${products.stock} - ${l.qty}` }
                  : {}),
              })
              .where(eq(products.id, l.p.id))
          ),

          ...stockLines
            .filter((l) => l.v && l.v.stock !== null)
            .map((l) =>
              db
                .update(productVariants)
                .set({
                  stock: sql`${productVariants.stock} - ${l.qty}`,
                })
                .where(eq(productVariants.id, l.v!.id))
            ),

          // مخزون المنتج ذي التركيبات = مجموع تركيباته بعد الخصم (وإلا يبقى رقمه القديم ويخفي النفاد).
          ...(variantProducts.length ? [syncVariantTotals(db, store.id, variantProducts)] : []),

          ...(discountId && !isTest
            ? [
                db
                  .update(discounts)
                  .set({ usedCount: sql`${discounts.usedCount} + 1` })
                  .where(eq(discounts.id, discountId)),
              ]
            : []),

          ...(input.visitorId
            ? [
                db
                  .update(abandonedCarts)
                  .set({ recoveredOrderId: orderId })
                  .where(
                    and(
                      eq(abandonedCarts.storeId, store.id),
                      eq(abandonedCarts.visitorId, input.visitorId)
                    )
                  ),
              ]
            : []),
        ]);
        break;
      } catch (e) {
        const info = dbErrorInfo(e);
        if (
          info.code === PG_UNIQUE &&
          info.constraint?.includes("orders_store_code_uq") &&
          attempt < ORDER_CODE_ATTEMPTS
        ) {
          continue;
        }
        if (info.code === PG_CHECK && info.constraint?.includes("stock")) {
          throw new CheckoutError(
            "عذراً، نفدت كمية أحد المنتجات قبل إتمام طلبك بقليل، يرجى مراجعة السلة"
          );
        }
        if (info.code === PG_CHECK && info.constraint?.includes("discounts")) {
          throw new CheckoutError(
            "تم استهلاك كود الخصم بالكامل أثناء إتمام الطلب",
            "discountCode"
          );
        }
        throw e;
      }
    }

    const done: Done = { code, total };
    if (idemKey)
      await redis.set(idemKey, done, { ex: IDEM_TTL_S }).catch(() => {});
    await grantOrderAccess(store.id, code);

    // إطلاق حدث Pusher للتاجر — fire-and-forget.
    void emitOrderCreated(store.id, {
      orderId,
      code,
      customerName: input.name,
      governorate: governorateName(input.governorate),
      totalPiasters: total,
      itemsCount: lines.reduce((a, l) => a + l.qty, 0),
      paymentMethod: input.paymentMethod,
      createdAt: now.toISOString(),
    });

    // «شراء» لميتا من الخادم (إن وضع التاجر البكسل ورمز الواجهة): بنفس معرّف حدث البكسل في المتصفح (رقم الطلب).
    const pixelId = isTest ? null : cleanMetaPixel(bp.seo?.metaPixelId);
    if (pixelId) {
      const hd = await headers();
      const ck = (await cookies()).getAll();
      const cookie = (n: string) => ck.find((c) => c.name === n)?.value ?? null;
      const capi = {
        pixelId,
        orderCode: code,
        totalPiasters: total,
        contentIds: [...new Set(lines.map((l) => l.p.id))],
        numItems: lines.reduce((a, l) => a + l.qty, 0),
        phone: input.phone,
        email: input.email,
        name: input.name,
        city: input.city,
        externalId: deviceId,
        ip: clientIp(hd),
        userAgent: hd.get("user-agent"),
        fbp: cookie("_fbp"),
        fbc: cookie("_fbc"),
        url: storeUrl(store.subdomain, "/checkout"),
        at: now,
      };
      after(async () => {
        const token = await metaCapiToken(store.id);
        if (token) await sendCapiPurchase({ ...capi, token });
      });
    }

    // بريد «طلب جديد» للتاجر خارج مسار استجابة الطلب (لا بريد لزبائن التاجر).
    after(async () => {
      try {
        const [m] = await platformDb
          .select({ email: merchants.email })
          .from(merchants)
          .where(eq(merchants.id, store.merchantId))
          .limit(1);

        if (m?.email) {
          await sendMerchantNewOrderEmail({
            merchantEmail: m.email,
            storeName: bp.brand.name,
            storeSubdomain: store.subdomain,
            storeId: store.id,
            merchantId: store.merchantId,
            orderCode: code,
            customerName: input.name,
            totalAmount: formatEgp(total),
            governorate: governorateName(input.governorate),
            adminOrderUrl: `${clientEnv.NEXT_PUBLIC_APP_URL}/dashboard/orders/${orderId}`,
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[checkout] post-order emails failed:", err);
      }
    });

    return { ok: true, data: done };
  } catch (e) {
    await release();
    if (e instanceof CheckoutError)
      return { ok: false, error: e.message, field: e.field };
    // eslint-disable-next-line no-console
    console.error("[checkout] placeOrder failed:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function quoteAction(
  subdomain: string,
  raw: unknown
): Promise<Quote> {
  const parsed = z
    .object({
      items: cartItemsSchema,
      governorate: z.string().max(40).default(""),
      paymentMethod: z.enum(["cod", "vodafone_cash", "instapay"]),
      discountCode: z.string().trim().toUpperCase().max(20).optional(),
      phone: z.string().max(30).optional(),
    })
    .safeParse(raw);

  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? GENERIC_ERROR,
    };
  const input = parsed.data;
  if (!(await allow("quote", await ip())))
    return { ok: false, error: "محاولات كثيرة، انتظر لحظة" };

  try {
    const store = await getStoreBySubdomain(subdomain);
    if (!store) return { ok: false, error: "المتجر لا يستقبل طلبات حالياً" };
    const bp = await getBlueprint(store.id);
    const { subtotal } = await priceLines(store.id, input.items, bp);

    let discount = 0;
    let discountError: string | undefined;
    let freeShip = false;

    if (input.discountCode) {
      const r = await validateDiscount(
        store.id,
        input.discountCode,
        subtotal,
        normalizeEgyptianPhone(input.phone) ?? ""
      );
      if ("error" in r) discountError = r.error;
      else {
        discount = r.amount;
        freeShip = r.freeShipping;
      }
    }

    let shipping: number | null = null;
    let codFee = 0;
    let shippingError: string | undefined;

    if (isGovernorate(input.governorate)) {
      if (freeShip) shipping = 0;
      else {
        try {
          const s = await computeShipping(
            store.id,
            bp,
            input.governorate,
            subtotal,
            input.paymentMethod
          );
          shipping = s.fee;
          codFee = s.codExtra;
        } catch (e) {
          if (!(e instanceof CheckoutError)) throw e;
          shippingError = e.message;
        }
      }
    }

    return {
      ok: true,
      subtotal,
      shipping,
      codFee,
      discount,
      total: Math.max(0, subtotal - discount) + (shipping ?? 0) + codFee,
      discountError,
      shippingError,
    };
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, error: e.message };
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function saveAbandonedAction(
  subdomain: string,
  raw: unknown
): Promise<void> {
  try {
    const parsed = z
      .object({
        visitorId: z.string().min(8).max(64),
        phone: z.string().max(30),
        name: z.string().trim().max(60).optional(),
        items: cartItemsSchema,
      })
      .safeParse(raw);

    if (!parsed.success) return;
    const phone = normalizeEgyptianPhone(parsed.data.phone);
    if (!phone) return;
    if (!(await allow("abandoned", await ip()))) return;
    const store = await getStoreBySubdomain(subdomain);
    if (!store) return;
    const db = await getTenantDb(store.id);

    const { lines, subtotal } = await priceLines(
      store.id,
      parsed.data.items
    );
    const items = lines.map((l) => ({
      productId: l.p.id,
      variantId: l.v?.id,
      name: l.p.name,
      qty: l.qty,
      unitPiasters: l.unit,
      imageUrl: (l.v?.imageUrl ?? l.p.images[0]?.url) || undefined,
    }));

    await db
      .insert(abandonedCarts)
      .values({
        storeId: store.id,
        visitorId: parsed.data.visitorId,
        phone,
        name: parsed.data.name || undefined,
        items,
        subtotalPiasters: subtotal,
      })
      .onConflictDoUpdate({
        target: [abandonedCarts.storeId, abandonedCarts.visitorId],
        set: {
          phone,
          name: parsed.data.name || undefined,
          items,
          subtotalPiasters: subtotal,
          lastSeenAt: new Date(),
        },
      });

    // حدث Pusher: سلة متروكة.
    void emitCartAbandoned(store.id, {
      cartId: parsed.data.visitorId,
      customerName: parsed.data.name ?? "زائر",
      phone,
      subtotalPiasters: subtotal,
      itemsCount: items.reduce((a, i) => a + i.qty, 0),
      lastSeenAt: new Date().toISOString(),
    });
  } catch {
    /* silent */
  }
}

const transferProofSchema = z.object({
  code: z.string().trim().min(1, "كود الطلب مطلوب"),
  senderPhone: z.string().transform((v, ctx) => {
    const n = normalizeEgyptianPhone(v);
    if (!n)
      ctx.addIssue({
        code: "custom",
        message: "رقم موبايل مصري غير صحيح",
      });
    return n ?? "";
  }),
  screenshotUrl: z.string().max(500).refine(isTrustedUploadUrl, "رابط صورة التحويل غير صحيح"),
  accessPhone: z.string().optional(),
});

export async function submitTransferProofAction(
  subdomain: string,
  raw: unknown
): Promise<ActionResult<{ success: true }>> {
  const parsed = transferProofSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message };
  }
  const input = parsed.data;

  try {
    const store = await getStoreBySubdomain(subdomain);
    if (!store) return { ok: false, error: "المتجر غير موجود" };
      const db = await getTenantDb(store.id);

    const [order] = await db
      .select()
      .from(orders)
      .where(
        and(eq(orders.storeId, store.id), eq(orders.code, input.code))
      )
      .limit(1);

    if (!order) return { ok: false, error: "الطلب غير موجود" };

    const hasAccess = await hasOrderAccess(store.id, input.code, order.visitorId);
    const normalizedAccessPhone = input.accessPhone
      ? normalizeEgyptianPhone(input.accessPhone)
      : null;
    const phoneMatches =
      normalizedAccessPhone && order.customerPhone === normalizedAccessPhone;

    if (!hasAccess && !phoneMatches) {
      return { ok: false, error: "غير مصرح لك بتحديث هذا الطلب" };
    }

    const now = new Date();
    const history = Array.isArray(order.statusHistory)
      ? [...order.statusHistory]
      : [];
    history.push({ status: "proof_submitted", at: now.toISOString() });

    await db
      .update(orders)
      .set({
        transferSenderPhone: input.senderPhone,
        transferScreenshotUrl: input.screenshotUrl,
        paymentStatus: "under_review",
        statusHistory: history,
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));

    return { ok: true, data: { success: true } };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[checkout] submitTransferProof failed:", e);
    return {
      ok: false,
      error: "تعذّر إرسال إثبات الدفع، يرجى المحاولة لاحقاً",
    };
  }
}