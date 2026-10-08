"use server";

import { unstable_rethrow } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";
import { marketingCampaigns, abandonedCarts, products, discounts } from "@/db/schema";
import { getMerchantSession } from "@/server/auth";
import { storeUrl } from "@/lib/utils";

export async function triggerCartRecoveryWaveAction(cartId: string, wave: 1 | 2 | 3) {
  try {
    const s = await getMerchantSession();
    if (!s || !s.storeId || !s.store) throw new Error("غير مصرح");
    const db = await getTenantDb(s.storeId);

    const [cart] = await db
      .select()
      .from(abandonedCarts)
      .where(and(eq(abandonedCarts.visitorId, cartId), eq(abandonedCarts.storeId, s.storeId)))
      .limit(1);

    if (!cart || !cart.phone) throw new Error("السلة غير موجودة أو لا تحتوي على رقم هاتف");

    let message = "";
    const checkoutLink = storeUrl(s.store.subdomain, "/checkout");

    if (wave === 1) {
      message = `أهلاً ${cart.name || "بك"}، لاحظنا أنك تركت منتجات في سلتك بمتجر ${s.store.name}. هل واجهت أي مشكلة؟ يمكنك إكمال طلبك من هنا: ${checkoutLink}`;
    } else if (wave === 2) {
      message = `مرحباً ${cart.name || "بك"}، المنتجات التي اخترتها من ${s.store.name} على وشك النفاد! سارع بإتمام طلبك قبل انتهاء الكمية: ${checkoutLink}`;
    } else if (wave === 3) {
      // إنشاء كود خصم تلقائي
      const discountCode = `COMEBACK${Math.floor(Math.random() * 900) + 100}`;
      await db.insert(discounts).values({
        storeId: s.storeId,
        code: discountCode,
        type: "percentage",
        value: 10,
        maxUses: 1,
        isActive: true,
        endsAt: new Date(Date.now() + 2 * 3600 * 1000), // صالح لساعتين
      });
      message = `مفاجأة من ${s.store.name}! خصم 10% مخصص لك لإتمام طلبك. استخدم الكود ${discountCode} عند الدفع. العرض صالح لساعتين فقط: ${checkoutLink}`;
    }

    // تسجيل الحملة
    await db.insert(marketingCampaigns).values({
      storeId: s.storeId,
      type: `cart_recovery_wave_${wave}`,
      targetId: cartId,
      status: "sent",
      scheduledFor: new Date(),
      sentAt: new Date(),
    });

    // إرجاع الرابط لفتح الواتساب في المتصفح
    const waLink = `https://wa.me/2${cart.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
    
    return { ok: true, data: { waLink } };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: e instanceof Error ? e.message : "فشل إطلاق الحملة" };
  }
}

export async function generateSocialCardAction(productId: string) {
  try {
    const s = await getMerchantSession();
    if (!s || !s.storeId || !s.store) throw new Error("غير مصرح");
    const db = await getTenantDb(s.storeId);

    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.storeId, s.storeId)))
      .limit(1);

    if (!product) throw new Error("المنتج غير موجود");

    return {
      ok: true,
      data: {
        storeName: s.store.name,
        productName: product.name,
        price: product.pricePiasters / 100,
        compareAt: product.compareAtPiasters ? product.compareAtPiasters / 100 : null,
        imageUrl: product.images[0]?.url || "",
      }
    };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "فشل جلب بيانات الكارت" };
  }
}