import "server-only";
// upload-policies.ts — من يحق له الرفع على كل مسار، ومن أي مساحة، وما يُسجَّل بعده. مصدر واحد يستخدمه مسار
// الرفع (app/api/upload). أي مسار جديد يُضاف هنا وفي lib/media.ts.
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { storeRequestAssets } from "@/db/schema/agency";
import { getMerchantSession } from "@/server/auth";
import { ownerStore, storeFor } from "@/server/merchant-guard";
import { getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";
import { allow } from "@/lib/ratelimit";
import { clientIp, ipBucket } from "@/lib/client-ip";
import { draftIsOpen, findByDraftToken } from "@/intake/repo";
import { hit } from "@/intake/guard";
import type { MediaRoute } from "@/lib/media";

export class UploadPolicyError extends Error {}

// ستة منتجات × عشر صور = 60، وهامش لمن يبدّل صوره قبل الإرسال (الصور المحذوفة تُنظَّف بعد الإرسال).
export const MAX_IMAGES_PER_REQUEST = 100;

/** ما يُحفظ مع الرفع: بادئة المفتاح في R2 (مساحة كل متجر/طلب منفصلة) وبيانات خطوة ما بعد الرفع. */
export type UploadGrant = { prefix: string; meta: Record<string, string | number | null> };
type Ctx = { headers: Headers; input: unknown };

const subdomainInput = z.object({ subdomain: z.string().min(1).max(63) });

async function publicStore(input: unknown) {
  const p = subdomainInput.safeParse(input);
  if (!p.success) throw new UploadPolicyError("طلب غير صالح");
  const store = await getStoreBySubdomain(p.data.subdomain);
  if (!store || !isStorePubliclyVisible(store)) throw new UploadPolicyError("متجر غير متاح");
  return store;
}

async function openDraft(token: string) {
  const row = await findByDraftToken(token).catch(() => null);
  if (!row || !draftIsOpen(row)) throw new UploadPolicyError("رابط الاستمارة غير صالح أو انتهت صلاحيته، حدّث الصفحة.");
  return row;
}

const POLICIES: Record<MediaRoute, (c: Ctx) => Promise<UploadGrant>> = {
  // صور المنتجات وصور محرر المحتوى: لمن يدير المنتجات أو المحتوى.
  async productImage() {
    const s = (await storeFor("products")) ?? (await storeFor("content"));
    if (!s) throw new UploadPolicyError("غير مصرح");
    return { prefix: `stores/${s.storeId}/products`, meta: { storeId: s.storeId } };
  },
  async brandAsset() {
    const s = (await storeFor("content")) ?? (await storeFor("settings")) ?? (await storeFor("products"));
    if (!s) throw new UploadPolicyError("غير مصرح");
    return { prefix: `stores/${s.storeId}/brand`, meta: { storeId: s.storeId } };
  },
  // إيصال تحويل التاجر للمنصة: لصاحب المتجر وحده، ويعمل والمتجر مجمّد.
  async platformReceipt() {
    const s = await ownerStore();
    if (!s?.store) throw new UploadPolicyError("الدفع لصاحب المتجر فقط. ادخل بحسابه.");
    if (!(await allow("proof", `ut_receipt:${s.merchantId}`))) throw new UploadPolicyError("محاولات كثيرة، حاول بعد دقائق");
    return { prefix: `stores/${s.store.id}/receipts`, meta: { storeId: s.store.id } };
  },
  async transferProof({ headers, input }) {
    if (!(await allow("proof", `ut:${clientIp(headers)}`))) throw new UploadPolicyError("محاولات كثيرة، حاول بعد دقائق");
    const store = await publicStore(input);
    return { prefix: `stores/${store.id}/proofs`, meta: { storeId: store.id } };
  },
  // صور تقييم العميل: 3 صور بحد أقصى، بحد معدل لكل عنوان، لمتجر ظاهر فقط.
  async customerReviewImage({ headers, input }) {
    if (!(await allow("review", `ut_review:${clientIp(headers)}`))) throw new UploadPolicyError("محاولات كثيرة، حاول بعد دقائق");
    const store = await publicStore(input);
    return { prefix: `stores/${store.id}/reviews`, meta: { storeId: store.id } };
  },
  async merchantAvatar() {
    const s = await getMerchantSession();
    if (!s) throw new UploadPolicyError("غير مصرح");
    return { prefix: `merchants/${s.merchantId}`, meta: { merchantId: s.merchantId } };
  },
  // استمارة طلب المتجر: بلا تسجيل دخول، الهوية رابط المسودة السري. كل ملف يُسجَّل في store_request_assets.
  async intakeImage({ headers, input }) {
    const p = z.object({ token: z.string().max(64), kind: z.enum(["image", "logo"]) }).safeParse(input);
    if (!p.success) throw new UploadPolicyError("طلب غير صالح");
    const row = await openDraft(p.data.token);
    const ip = ipBucket(clientIp(headers));
    if (!(await hit(`up:req:${row.id}`, 150, 3600)) || !(await hit(`up:ip:${ip}`, 250, 3600))) throw new UploadPolicyError("رفع كتير في وقت قصير، انتظر دقيقة ثم كمّل.");
    const [c] = await db
      .select({ n: count() })
      .from(storeRequestAssets)
      .where(and(eq(storeRequestAssets.requestId, row.id), eq(storeRequestAssets.kind, p.data.kind)));
    if ((c?.n ?? 0) >= (p.data.kind === "logo" ? 10 : MAX_IMAGES_PER_REQUEST)) throw new UploadPolicyError("وصلت للحد الأقصى من الصور في الطلب.");
    return { prefix: `requests/${row.id}`, meta: { requestId: row.id, kind: p.data.kind } };
  },
  // بحث العميل بالصورة: متجر ظاهر، بحد معدل، والملف مؤقت في مساحة tmp (تحذفه قاعدة انتهاء في الـ bucket).
  async visualSearch({ headers, input }) {
    if (!(await hit(`vs:ip:${ipBucket(clientIp(headers))}`, 30, 3600))) throw new UploadPolicyError("بحث كتير في وقت قصير، انتظر قليلاً.");
    const store = await publicStore(input);
    return { prefix: `tmp/vs/${store.id}`, meta: { storeId: store.id } };
  },
};

export function authorizeUpload(route: MediaRoute, ctx: Ctx): Promise<UploadGrant> {
  return POLICIES[route](ctx);
}

/** ما بعد الرفع: ملفات الاستمارة تُسجَّل للطلب (الإرسال لا يقبل إلا مفاتيح مسجلة لنفس الطلب). */
export async function afterUpload(
  route: MediaRoute,
  meta: UploadGrant["meta"],
  file: { key: string; url: string; type: string; size: number }
): Promise<void> {
  if (route !== "intakeImage") return;
  await db
    .insert(storeRequestAssets)
    .values({
      requestId: String(meta.requestId),
      key: file.key,
      url: file.url,
      kind: String(meta.kind) as "image" | "logo",
      mime: file.type,
      sizeBytes: file.size,
    })
    .onConflictDoNothing({ target: storeRequestAssets.key });
}
