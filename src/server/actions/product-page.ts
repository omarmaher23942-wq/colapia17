"use server";
// product-page.ts — إجراءات الزائر في صفحة المنتج: سؤال عن المنتج، وتحميل المزيد من التقييمات.
// الأسئلة تُحفظ «قيد الانتظار» ولا تظهر للزوار إلا بعد إجابة التاجر.
import { headers } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getTenantDb } from "@/db/tenant";
import { products, productQuestions } from "@/db/schema";
import { allow, clientIp } from "@/lib/ratelimit";
import { getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";
import { normalizeEgyptianPhone } from "@/lib/phone";
import { validateQuestion } from "@/lib/pdp";
import { productReviews } from "@/server/repos/catalog";

const askSchema = z.object({
  subdomain: z.string().min(1).max(63),
  productId: z.string().uuid(),
  question: z.string().max(1000),
  name: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
});

export async function askProductQuestionAction(raw: z.input<typeof askSchema>): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = askSchema.safeParse(raw);
  if (!p.success) return { ok: false, error: "بيانات غير صالحة" };
  const v = validateQuestion({ question: p.data.question, name: p.data.name });
  if (!v.ok) return v;
  let phone: string | null = null;
  if (p.data.phone?.trim()) {
    phone = normalizeEgyptianPhone(p.data.phone);
    if (!phone) return { ok: false, error: "رقم الموبايل غير صحيح (مثال: 01012345678)" };
  }
  if (!(await allow("review", `ask:${clientIp(await headers())}`))) return { ok: false, error: "محاولات كثيرة، يرجى المحاولة بعد دقائق" };

  const store = await getStoreBySubdomain(p.data.subdomain);
  if (!store || !isStorePubliclyVisible(store)) return { ok: false, error: "المتجر غير متاح الآن" };
  const db = await getTenantDb(store.id);
  const [prod] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, p.data.productId), eq(products.storeId, store.id), isNull(products.deletedAt)))
    .limit(1);
  if (!prod) return { ok: false, error: "المنتج غير موجود" };
  await db.insert(productQuestions).values({ storeId: store.id, productId: prod.id, question: v.question, askerName: v.name, askerPhone: phone, status: "pending" });
  return { ok: true };
}

const moreSchema = z.object({ subdomain: z.string().min(1).max(63), productId: z.string().uuid(), offset: z.number().int().min(0).max(500) });

export async function moreReviewsAction(raw: z.input<typeof moreSchema>) {
  const p = moreSchema.safeParse(raw);
  if (!p.success) return [];
  const store = await getStoreBySubdomain(p.data.subdomain);
  if (!store || !isStorePubliclyVisible(store)) return [];
  const rows = await productReviews(store.id, p.data.productId, { limit: 8, offset: p.data.offset });
  return rows.map((r) => ({ id: r.id, customerName: r.customerName, rating: r.rating, body: r.body, imageUrls: r.imageUrls, isVerified: r.isVerified, createdAt: r.createdAt.toISOString() }));
}
