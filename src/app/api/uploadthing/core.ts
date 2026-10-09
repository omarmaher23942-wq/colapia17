// uploadthing/core.ts — File Router لمنصة Colapia.
// التعديل: إضافة endpoint merchantAvatar لصورة التاجر (4MB، صورة واحدة).
// نستخدم getMerchantSession للتحقق، ونُعيد key + url + merchantId.
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { z } from "zod";
import { getMerchantSession } from "@/server/auth";
import { getStoreBySubdomain, isStorePubliclyVisible } from "@/lib/tenant";
import { allow, clientIp } from "@/lib/ratelimit";
import { onboardingImageRoute } from "@/onboarding/uploader";

const f = createUploadthing();

export const fileRouter = {
  productImage: f({ image: { maxFileSize: "8MB", maxFileCount: 10 } })
    .middleware(async () => {
      const s = await getMerchantSession();
      if (!s) throw new UploadThingError("غير مصرح");
      return { storeId: s.storeId };
    })
    .onUploadComplete(async ({ file, metadata }) => ({
      url: file.ufsUrl,
      key: file.key,
      storeId: metadata.storeId,
    })),

  brandAsset: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const s = await getMerchantSession();
      if (!s) throw new UploadThingError("غير مصرح");
      return { storeId: s.storeId };
    })
    .onUploadComplete(async ({ file }) => ({ url: file.ufsUrl, key: file.key })),

  // إيصال تحويل التاجر للمنصة (صفحة الدفع): لصاحب المتجر المسجّل فقط، ويعمل والمتجر مجمّد (حين يحتاجه أكثر).
  platformReceipt: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .middleware(async () => {
      const s = await getMerchantSession();
      if (!s?.store) throw new UploadThingError("سجّل الدخول بحساب صاحب المتجر أولاً");
      if (!(await allow("proof", `ut_receipt:${s.merchantId}`))) {
        throw new UploadThingError("محاولات كثيرة، حاول بعد دقائق");
      }
      return { storeId: s.store.id };
    })
    .onUploadComplete(async ({ file }) => ({ url: file.ufsUrl })),

  transferProof: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .input(z.object({ subdomain: z.string().min(1).max(63) }))
    .middleware(async ({ req, input }) => {
      if (!(await allow("proof", `ut:${clientIp(req.headers)}`))) {
        throw new UploadThingError("محاولات كثيرة، حاول بعد دقائق");
      }
      const store = await getStoreBySubdomain(input.subdomain);
      if (!store || !isStorePubliclyVisible(store)) {
        throw new UploadThingError("متجر غير متاح");
      }
      return { storeId: store.id };
    })
    .onUploadComplete(async ({ file }) => ({ url: file.ufsUrl })),

  // صور تقييم العميل (صفحة «قيّم مشترياتك»): 3 صور بحد أقصى، بحد معدل لكل عنوان، لمتجر ظاهر فقط.
  customerReviewImage: f({ image: { maxFileSize: "4MB", maxFileCount: 3 } })
    .input(z.object({ subdomain: z.string().min(1).max(63) }))
    .middleware(async ({ req, input }) => {
      if (!(await allow("review", `ut_review:${clientIp(req.headers)}`))) {
        throw new UploadThingError("محاولات كثيرة، حاول بعد دقائق");
      }
      const store = await getStoreBySubdomain(input.subdomain);
      if (!store || !isStorePubliclyVisible(store)) {
        throw new UploadThingError("متجر غير متاح");
      }
      return { storeId: store.id };
    })
    .onUploadComplete(async ({ file }) => ({ url: file.ufsUrl, key: file.key })),

  // endpoint جديد لصورة التاجر الشخصية.
  // يقبل صورة واحدة بحجم أقصى 4MB، ويتحقق من جلسة التاجر.
  merchantAvatar: f({
    image: { maxFileSize: "4MB", maxFileCount: 1 },
  })
    .middleware(async () => {
      const s = await getMerchantSession();
      if (!s) throw new UploadThingError("غير مصرح");
      return { merchantId: s.merchantId };
    })
    .onUploadComplete(async ({ file, metadata }) => ({
      url: file.ufsUrl,
      key: file.key,
      merchantId: metadata.merchantId,
    })),

  onboardingImage: onboardingImageRoute(f),
} satisfies FileRouter;

export type AppFileRouter = typeof fileRouter;