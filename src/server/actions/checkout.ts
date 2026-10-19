"use server";

import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
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
import { phoneOrderBlock } from "@/lib/order-spam";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";
import { emitOrderCreated } from "@/server/realtime/emitters";
import { syncVariantTotals } from "@/server/inventory";
import { getMerchantSession } from "@/server/auth";
import { isDemoStore, isTestOrder } from "@/lib/demo-store";
import { hostingServes, hostingState } from "@/lib/hosting";
import { dbErrorInfo, PG_CHECK, PG_UNIQUE } from "@/lib/db-errors";
import { nextOrderCode } from "@/server/order-seq";
import { CheckoutError, GOV_CODES, cartItemsSchema, priceLines, quoteCart, type CartQuote } from "@/server/order-lines";
import { isTeamPreview } from "@/server/store-preview";
import type { OrderGift } from "@/db/schema/commerce";
import { hostingGraceDays } from "@/server/hosting-grace";


export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

export type QuoteLine = {
  key: string;
  productId: string;
  variantId?: string;
  name: string;
  unit: number;
  qty: number;
  net: number;
  lineOff: number;
  reason: "volume" | "bundle" | null;
  isGift: boolean;
};

/** عرض سعر الخادم: هذه الأرقام هي الحقيقة، وما في السلة على الجهاز تقدير فقط. */
export type Quote =
  | {
      ok: true;
      lines: QuoteLine[];
      gross: number;
      /** مجموع الأسطر بعد خصم الكمية والطقم. */
      subtotal: number;
      adjustments: { kind: "auto" | "coupon" | "prepaid"; label: string; amount: number }[];
      discount: number;
      afterDiscount: number;
      shipping: number | null;
      codFee: number;
      giftWrap: number;
      total: number | null;
      freeShipping: null | "coupon" | "threshold";
      nudges: { kind: "gift" | "discount" | "free_shipping"; label: string; remainingPiasters: number }[];
      discountError?: string;
      shippingError?: string;
    }
  | { ok: false; error: string };

function toQuote(cq: CartQuote, extra: { shippingError?: string } = {}): Extract<Quote, { ok: true }> {
  const r = cq.result;
  return {
    ok: true,
    lines: r.lines.map((l) => ({
      key: l.key,
      productId: l.productId,
      variantId: l.variantId ?? undefined,
      name: l.name,
      unit: l.unit,
      qty: l.qty,
      net: l.net,
      lineOff: l.lineOff,
      reason: l.lineOffReason,
      isGift: l.isGift,
    })),
    gross: r.gross,
    subtotal: r.subtotal,
    adjustments: r.adjustments.map((x) => ({ kind: x.kind, label: x.label, amount: x.amount })),
    discount: r.orderDiscount,
    afterDiscount: r.afterDiscount,
    shipping: r.shipping,
    codFee: r.codFee,
    giftWrap: r.giftWrap,
    total: r.total,
    freeShipping: r.freeShipping,
    nudges: r.nudges,
    discountError: cq.couponError,
    shippingError: extra.shippingError,
  };
}

const GENERIC_ERROR = "حدث خطأ أثناء تنفيذ طلبكم، يرجى المحاولة مرة أخرى";
const IDEM_TTL_S = 900;
const ORDER_CODE_ATTEMPTS = 3;

const paymentMethodSchema = z.enum(["cod", "vodafone_cash", "instapay"]);

const giftSchema = z.object({
  wrap: z.boolean().default(false),
  message: z.string().trim().max(200).optional(),
  hidePrices: z.boolean().default(false),
});

const checkoutSchema = z.object({
  name: z.string().trim().min(2, "اكتبوا الاسم بالكامل").max(60),
  phone: z.string().transform((v, ctx) => {
    const n = normalizeEgyptianPhone(v);
    if (!n)
      ctx.addIssue({
        code: "custom",
        message: "رقم موبايل مصري غير صحيح (مثال: 01012345678)",
      });
    return n ?? "";
  }),
  altPhone: z
    .string()
    .optional()
    .transform((v) => (v ? normalizeEgyptianPhone(v) ?? undefined : undefined)),
  governorate: z.enum(GOV_CODES, { message: "اختاروا المحافظة" }),
  city: z.string().trim().max(60).optional(),
  address: z.string().trim().min(5, "اكتبوا اسم الشارع ورقم العمارة والشقة").max(300),
  landmark: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(300).optional(),
  paymentMethod: paymentMethodSchema,
  discountCode: z.string().trim().toUpperCase().max(20).optional(),
  transferSenderPhone: z.string().max(30).optional(),
  transferScreenshotUrl: z.string().max(500).refine(isTrustedUploadUrl, "رابط صورة التحويل غير صالح").optional(),
  gift: giftSchema.optional(),
  items: cartItemsSchema,
  idempotencyKey: z.string().min(8).max(64).optional(),
});

type Done = { code: string; total: number };

async function ip() {
  return clientIp(await headers());
}

export async function placeOrderAction(subdomain: string, raw: unknown): Promise<ActionResult<Done>> {
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
  // صاحب المتجر وفريقه (تمرير المالك) يجرّبون الشراء حتى قبل النشر؛ الزوار لا.
  const teamPass = await isTeamPreview();
  if (!store || (!teamPass && !isStorePubliclyVisible(store)) || (!teamPass && !hostingServes(hostingState(store, new Date(), await hostingGraceDays().catch(() => undefined)))))
    return { ok: false, error: "المتجر لا يستقبل طلبات حالياً" };
  const db = await getTenantDb(store.id);
  if (!store.acceptingOrders && !teamPass)
    return { ok: false, error: store.vacationMessage || "المتجر متوقف مؤقتاً عن استقبال الطلبات" };

  const idemKey = input.idempotencyKey ? `idem:order:${store.id}:${input.idempotencyKey}` : null;
  if (idemKey) {
    let claimed = true;
    try {
      claimed = !!(await redis.set(idemKey, "pending", { nx: true, ex: IDEM_TTL_S }));
    } catch {
      claimed = true;
    }
    if (!claimed) {
      const prev = await redis.get<Done | string>(idemKey).catch(() => null);
      if (prev && typeof prev === "object" && typeof (prev as Done).code === "string") {
        await grantOrderAccess(store.id, (prev as Done).code);
        return { ok: true, data: prev as Done };
      }
      return { ok: false, error: "طلبكم قيد التنفيذ، يرجى الانتظار ثوانٍ" };
    }
  }

  const release = async () => {
    if (idemKey) await redis.del(idemKey).catch(() => {});
  };

  if (!(await allow("checkout", await ip()))) {
    await release();
    return { ok: false, error: "محاولات كثيرة في وقت قصير، يرجى الانتظار بضع دقائق" };
  }

  try {
    const bp = await getBlueprint(store.id);
    const pm = bp.payments;
    if (
      (input.paymentMethod === "cod" && !pm.cod.enabled) ||
      (input.paymentMethod === "vodafone_cash" && !pm.vodafoneCash.enabled) ||
      (input.paymentMethod === "instapay" && !pm.instapay.enabled)
    ) {
      throw new CheckoutError("وسيلة الدفع المختارة غير متاحة", "paymentMethod");
    }
    const giftOn = Boolean(input.gift && (bp.shipping.giftEnabled ?? true) && (input.gift.wrap || input.gift.message || input.gift.hidePrices));

    const cq = await quoteCart(store.id, bp, {
      items: input.items,
      governorate: input.governorate,
      paymentMethod: input.paymentMethod,
      discountCode: input.discountCode,
      phone: input.phone,
      giftWrap: giftOn && input.gift!.wrap,
    });
    if (input.discountCode && cq.couponError) throw new CheckoutError(cq.couponError, "discountCode");
    const r = cq.result;
    if (r.total === null || r.shipping === null) throw new CheckoutError("اختاروا المحافظة أولاً", "governorate");
    const total = r.total;
    const subtotal = r.subtotal;
    const shippingFee = r.shipping;
    const codFee = r.codFee;

    const [existingCustomer] = await db
      .select({ isBlocked: customers.isBlocked })
      .from(customers)
      .where(and(eq(customers.storeId, store.id), eq(customers.phone, input.phone)))
      .limit(1);
    if (existingCustomer?.isBlocked) {
      throw new CheckoutError("عذراً، تعذر إتمام الطلب، يرجى التواصل مع المتجر مباشرة");
    }

    const now = new Date();
    // الطلب يُحفظ بجهاز العميل: يجده في «طلباتي» على نفس الجهاز دون حساب ولا رقم طلب.
    const deviceId = await ensureDeviceId(store.id);
    // طلب تجريبي: صاحب المتجر أو فريقه من متجرهم (تجربة الشراء)، أو أي طلب في متجر العرض. لا يخصم المخزون
    // ولا يُحسب في المبيعات والعدادات، ولا يُرسل عنه بريد ولا حدث بكسل.
    const demoStore = isDemoStore(store);
    const owner = teamPass || demoStore ? null : await getMerchantSession().catch(() => null);
    const isTest = isTestOrder({ teamPreview: teamPass, ownStore: Boolean(owner?.stores.some((x) => x.id === store.id)), demoStore });
    const counted = isTest ? 0 : 1;
    if (!isTest) {
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
    const customerRef = sql`(select ${customers.id} from ${customers} where ${customers.storeId} = ${store.id} and ${customers.phone} = ${input.phone})`;
    const giftData: OrderGift | null = giftOn ? { wrap: input.gift!.wrap, message: input.gift!.message || undefined, hidePrices: input.gift!.hidePrices } : null;

    // أسطر الطلب: المنتجات بخصم كل سطر، ثم الهدايا المجانية (بسعر صفر).
    const productLines = r.lines.filter((l) => !l.isGift);
    const giftLines = r.lines.filter((l) => l.isGift);
    const lineOf = new Map(cq.lines.map((l, i) => [cq.engineKeys[i]!, l]));
    const giftIds = [...new Set(giftLines.map((g) => g.productId))];
    const giftRows = giftIds.length ? await db.select().from(products).where(and(eq(products.storeId, store.id), inArray(products.id, giftIds))) : [];
    const couponUsed = cq.couponRow && !cq.couponError ? cq.couponRow : null;
    const usedDiscountIds = [...cq.autoIds.filter((id) => r.adjustments.some((a) => a.id === id)), ...(couponUsed ? [couponUsed.id] : [])];

    let orderId = "";
    let code = "";

    for (let attempt = 1; ; attempt++) {
      orderId = crypto.randomUUID();
      code = await nextOrderCode(store.id, bp.invoice.orderPrefix);

      try {
        const stockLines = isTest ? [] : cq.lines.filter((l) => l.p.trackStock);
        const variantProducts = [...new Set(stockLines.filter((l) => l.v && l.v.stock !== null).map((l) => l.p.id))];
        await db.batch([
          db
            .insert(customers)
            .values({
              storeId: store.id,
              phone: input.phone,
              name: input.name,
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
            customerAltPhone: input.altPhone,
            governorate: input.governorate,
            city: input.city,
            address: input.address,
            landmark: input.landmark,
            customerNotes: input.notes,
            subtotalPiasters: subtotal,
            shippingPiasters: shippingFee,
            codFeePiasters: codFee,
            discountPiasters: r.orderDiscount,
            discountCode: couponUsed?.code,
            totalPiasters: total,
            paymentMethod: input.paymentMethod,
            paymentStatus: input.paymentMethod === "cod" ? "pending" : "under_review",
            transferSenderPhone: input.paymentMethod === "cod" ? null : input.transferSenderPhone || input.phone,
            transferScreenshotUrl: input.paymentMethod === "cod" ? null : input.transferScreenshotUrl || null,
            statusHistory: [{ status: "new", at: now.toISOString() }],
            source: orderSourceFrom((await cookies()).get(CAMPAIGN_COOKIE)?.value, bp.campaigns),
            visitorId: deviceId,
            idempotencyKey: input.idempotencyKey,
            gift: giftData,
            isTest,
          }),

          db.insert(orderItems).values([
            ...productLines.map((o) => {
              const l = lineOf.get(o.key)!;
              return {
                orderId,
                storeId: store.id,
                productId: l.p.id,
                variantId: l.v?.id,
                name: l.p.name,
                variantLabel: l.v?.optionValues.join(" / "),
                imageUrl: l.v?.imageUrl ?? l.p.images[0]?.url,
                unitPiasters: o.unit,
                quantity: o.qty,
                totalPiasters: o.net,
                discountPiasters: o.lineOff,
              };
            }),
            ...giftLines.map((g) => {
              const p = giftRows.find((x) => x.id === g.productId);
              return {
                orderId,
                storeId: store.id,
                productId: g.productId,
                name: `هدية: ${g.name}`,
                imageUrl: p?.images[0]?.url,
                unitPiasters: 0,
                quantity: 1,
                totalPiasters: 0,
                discountPiasters: 0,
              };
            }),
          ]),

          ...(isTest ? [] : cq.lines).map((l) =>
            db
              .update(products)
              .set({
                orderCount: sql`${products.orderCount} + ${l.qty}`,
                ...(l.p.trackStock && !l.v && l.p.stock !== null ? { stock: sql`${products.stock} - ${l.qty}` } : {}),
              })
              .where(eq(products.id, l.p.id))
          ),

          ...(isTest ? [] : giftRows)
            .filter((p) => p.trackStock && p.stock !== null)
            .map((p) => db.update(products).set({ stock: sql`${products.stock} - 1` }).where(eq(products.id, p.id))),

          ...stockLines
            .filter((l) => l.v && l.v.stock !== null)
            .map((l) => db.update(productVariants).set({ stock: sql`${productVariants.stock} - ${l.qty}` }).where(eq(productVariants.id, l.v!.id))),

          // مخزون المنتج ذي التركيبات = مجموع تركيباته بعد الخصم (وإلا يبقى رقمه القديم ويخفي النفاد).
          ...(variantProducts.length ? [syncVariantTotals(db, store.id, variantProducts)] : []),

          ...(!isTest
            ? usedDiscountIds.map((id) => db.update(discounts).set({ usedCount: sql`${discounts.usedCount} + 1` }).where(eq(discounts.id, id)))
            : []),

          // السلة المتروكة تُعدّ مستردة إن أُتم الطلب من نفس الجهاز أو بنفس الرقم.
          db
            .update(abandonedCarts)
            .set({ recoveredOrderId: orderId })
            .where(
              and(
                eq(abandonedCarts.storeId, store.id),
                isNull(abandonedCarts.recoveredOrderId),
                or(eq(abandonedCarts.visitorId, deviceId), eq(abandonedCarts.phone, input.phone))
              )
            ),
        ]);
        break;
      } catch (e) {
        const info = dbErrorInfo(e);
        if (info.code === PG_UNIQUE && info.constraint?.includes("orders_store_code_uq") && attempt < ORDER_CODE_ATTEMPTS) continue;
        if (info.code === PG_CHECK && info.constraint?.includes("stock")) {
          throw new CheckoutError("عذراً، نفدت كمية أحد المنتجات قبل إتمام الطلب بقليل، يرجى مراجعة السلة");
        }
        if (info.code === PG_CHECK && info.constraint?.includes("discounts")) {
          throw new CheckoutError("تم استهلاك الخصم بالكامل أثناء إتمام الطلب، يرجى مراجعة الإجمالي", "discountCode");
        }
        throw e;
      }
    }

    const done: Done = { code, total };
    if (idemKey) await redis.set(idemKey, done, { ex: IDEM_TTL_S }).catch(() => {});
    await grantOrderAccess(store.id, code);

    // إطلاق حدث Pusher للتاجر — fire-and-forget (الطلب التجريبي بلا نغمة).
    if (!isTest) {
      void emitOrderCreated(store.id, {
        orderId,
        code,
        customerName: input.name,
        governorate: governorateName(input.governorate),
        totalPiasters: total,
        itemsCount: cq.lines.reduce((a, l) => a + l.qty, 0),
        paymentMethod: input.paymentMethod,
        createdAt: now.toISOString(),
      });
    }

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
        contentIds: [...new Set(cq.lines.map((l) => l.p.id))],
        numItems: cq.lines.reduce((a, l) => a + l.qty, 0),
        phone: input.phone,
        email: undefined,
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
    if (!isTest) {
      after(async () => {
        try {
          const [m] = await platformDb.select({ email: merchants.email }).from(merchants).where(eq(merchants.id, store.merchantId)).limit(1);
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
    }

    return { ok: true, data: done };
  } catch (e) {
    await release();
    if (e instanceof CheckoutError) return { ok: false, error: e.message, field: e.field };
    // eslint-disable-next-line no-console
    console.error("[checkout] placeOrder failed:", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function quoteAction(subdomain: string, raw: unknown): Promise<Quote> {
  const parsed = z
    .object({
      items: cartItemsSchema,
      governorate: z.string().max(40).default(""),
      paymentMethod: paymentMethodSchema,
      discountCode: z.string().trim().toUpperCase().max(20).optional(),
      phone: z.string().max(30).optional(),
      giftWrap: z.boolean().optional(),
    })
    .safeParse(raw);

  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  const input = parsed.data;
  if (!(await allow("quote", await ip()))) return { ok: false, error: "محاولات كثيرة، يرجى الانتظار لحظة" };

  try {
    const store = await getStoreBySubdomain(subdomain);
    if (!store) return { ok: false, error: "المتجر لا يستقبل طلبات حالياً" };
    const bp = await getBlueprint(store.id);
    const base = {
      items: input.items,
      paymentMethod: input.paymentMethod,
      discountCode: input.discountCode,
      phone: normalizeEgyptianPhone(input.phone) ?? "",
      giftWrap: Boolean(input.giftWrap && (bp.shipping.giftEnabled ?? true)),
    };
    try {
      return toQuote(await quoteCart(store.id, bp, { ...base, governorate: input.governorate || undefined }));
    } catch (e) {
      // محافظة غير مخدومة: السلة تُسعَّر بلا شحن مع شرح السبب.
      if (e instanceof CheckoutError && e.field === "governorate") return toQuote(await quoteCart(store.id, bp, base), { shippingError: e.message });
      throw e;
    }
  } catch (e) {
    if (e instanceof CheckoutError) return { ok: false, error: e.message };
    return { ok: false, error: GENERIC_ERROR };
  }
}

export async function saveAbandonedAction(subdomain: string, raw: unknown): Promise<void> {
  try {
    const parsed = z
      .object({
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
    // متجر العرض لا يحفظ بيانات زواره: طلباته تجريبية ولا سلات متروكة يُتواصل بشأنها.
    if (!store || isDemoStore(store)) return;
    const db = await getTenantDb(store.id);
    // هوية الجهاز من الخادم (لا قيمة يرسلها المتصفح).
    const deviceId = await ensureDeviceId(store.id);

    const { lines, subtotal } = await priceLines(store.id, parsed.data.items);
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
      .values({ storeId: store.id, visitorId: deviceId, phone, name: parsed.data.name || undefined, items, subtotalPiasters: subtotal })
      .onConflictDoUpdate({
        target: [abandonedCarts.storeId, abandonedCarts.visitorId],
        set: {
          phone,
          name: parsed.data.name || undefined,
          items,
          subtotalPiasters: subtotal,
          // سلة جديدة بعد طلب مكتمل تبدأ من جديد (وإلا بقيت «مستردة» فلا تظهر للتاجر أبداً).
          recoveredOrderId: null,
          whatsappContactedAt: null,
          lastSeenAt: new Date(),
        },
      });
  } catch {
    /* silent */
  }
}

const transferProofSchema = z.object({
  code: z.string().trim().min(1, "رقم الطلب مطلوب"),
  senderPhone: z.string().transform((v, ctx) => {
    const n = normalizeEgyptianPhone(v);
    if (!n) ctx.addIssue({ code: "custom", message: "رقم موبايل مصري غير صحيح" });
    return n ?? "";
  }),
  screenshotUrl: z.string().max(500).refine(isTrustedUploadUrl, "رابط صورة التحويل غير صحيح"),
  accessPhone: z.string().optional(),
});

export async function submitTransferProofAction(subdomain: string, raw: unknown): Promise<ActionResult<{ success: true }>> {
  const parsed = transferProofSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const input = parsed.data;

  try {
    const store = await getStoreBySubdomain(subdomain);
    if (!store) return { ok: false, error: "المتجر غير موجود" };
    const db = await getTenantDb(store.id);

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.storeId, store.id), eq(orders.code, input.code.toUpperCase())))
      .limit(1);
    if (!order) return { ok: false, error: "الطلب غير موجود" };

    const hasAccess = await hasOrderAccess(store.id, order.code, order.visitorId);
    const normalizedAccessPhone = input.accessPhone ? normalizeEgyptianPhone(input.accessPhone) : null;
    const phoneMatches = normalizedAccessPhone && order.customerPhone === normalizedAccessPhone;
    if (!hasAccess && !phoneMatches) return { ok: false, error: "غير مصرح بتحديث هذا الطلب" };

    // الإيصال للتحويل فقط، وقبل التأكيد: الطلب عند الاستلام أو المؤكد دفعه أو الملغي لا يقبل إيصالاً.
    if (order.paymentMethod === "cod") return { ok: false, error: "هذا الطلب بالدفع عند الاستلام ولا يحتاج إيصالاً" };
    if (order.paymentStatus === "confirmed" || order.paymentStatus === "refunded") return { ok: false, error: "تم تأكيد دفع هذا الطلب بالفعل" };
    if (order.status === "cancelled" || order.status === "returned") return { ok: false, error: "هذا الطلب لم يعد قائماً" };

    const now = new Date();
    const history = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];
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
      .where(and(eq(orders.id, order.id), eq(orders.storeId, store.id)));

    return { ok: true, data: { success: true } };
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[checkout] submitTransferProof failed:", e);
    return { ok: false, error: "تعذّر إرسال إثبات الدفع، يرجى المحاولة لاحقاً" };
  }
}
