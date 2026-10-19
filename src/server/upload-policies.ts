import "server-only";
// upload-policies.ts — من يحق له الرفع على كل مسار، ومن أي مساحة، وما يُسجَّل بعده. مصدر واحد يستخدمه مسار
// الرفع (app/api/upload). أي مسار جديد يُضاف هنا وفي lib/media.ts.
import { z } from "zod";
import { getMerchantSession } from "@/server/auth";
import { ownerStore, storeFor } from "@/server/merchant-guard";
import { getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";
import { allow } from "@/lib/ratelimit";
import { clientIp, ipBucket } from "@/lib/client-ip";
import { hit } from "@/lib/rate-hit";
import type { MediaRoute } from "@/lib/media";

export class UploadPolicyError extends Error {}

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
  // فيديو واجهة المتجر: لمن يدير المحتوى.
  async brandVideo() {
    const s = await storeFor("content");
    if (!s) throw new UploadPolicyError("غير مصرح");
    return { prefix: `stores/${s.storeId}/hero`, meta: { storeId: s.storeId } };
  },
  // إيصال تحويل التاجر للمنصة: لصاحب المتجر وحده، ويعمل والمتجر مجمّد.
  async platformReceipt() {
    const s = await ownerStore({ allowLocked: true });
    if (!s?.store) throw new UploadPolicyError("الدفع لصاحب المتجر فقط. ادخلوا بحسابه.");
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
  // صور طلب الاستبدال/الاسترجاع: حد معدل لكل عنوان، لمتجر ظاهر فقط.
  async returnPhoto({ headers, input }) {
    if (!(await allow("review", `ut_return:${clientIp(headers)}`))) throw new UploadPolicyError("محاولات كثيرة، حاول بعد دقائق");
    const store = await publicStore(input);
    return { prefix: `stores/${store.id}/returns`, meta: { storeId: store.id } };
  },
  async merchantAvatar() {
    const s = await getMerchantSession();
    if (!s) throw new UploadPolicyError("غير مصرح");
    return { prefix: `merchants/${s.merchantId}`, meta: { merchantId: s.merchantId } };
  },
  // بحث العميل بالصورة: متجر ظاهر، بحد معدل، والملف مؤقت في مساحة tmp (تحذفه قاعدة انتهاء في الـ bucket).
  async visualSearch({ headers, input }) {
    if (!(await hit(`vs:ip:${ipBucket(clientIp(headers))}`, 30, 3600))) throw new UploadPolicyError("عمليات بحث كثيرة في وقت قصير. انتظروا قليلاً ثم أعيدوا المحاولة.");
    const store = await publicStore(input);
    return { prefix: `tmp/vs/${store.id}`, meta: { storeId: store.id } };
  },
};

export function authorizeUpload(route: MediaRoute, ctx: Ctx): Promise<UploadGrant> {
  return POLICIES[route](ctx);
}

/** ما بعد الرفع: لا مسار يحتاج تسجيلاً حالياً (الخطاف باقٍ لمسارات لاحقة). */
export async function afterUpload(
  _route: MediaRoute,
  _meta: UploadGrant["meta"],
  _file: { key: string; url: string; type: string; size: number }
): Promise<void> {}
