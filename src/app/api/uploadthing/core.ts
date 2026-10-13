// uploadthing/core.ts — مسار الرفع القديم (UploadThing) ما دام NEXT_PUBLIC_MEDIA_PROVIDER ليس r2. الصلاحيات والتسجيل
// بعد الرفع من مصدر واحد مع مسار R2: server/upload-policies.ts.
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { z } from "zod";
import { afterUpload, authorizeUpload, UploadPolicyError } from "@/server/upload-policies";
import type { MediaRoute } from "@/lib/media";

const f = createUploadthing();

const guard =
  (route: MediaRoute) =>
  async ({ req, input }: { req: Request; input?: unknown }) => {
    try {
      return (await authorizeUpload(route, { headers: req.headers, input })).meta;
    } catch (e) {
      if (e instanceof UploadPolicyError) throw new UploadThingError(e.message);
      throw e;
    }
  };

const done =
  (route: MediaRoute) =>
  async ({ file, metadata }: { file: { key: string; ufsUrl: string; type: string; size: number }; metadata: Record<string, string | number | null> }) => {
    await afterUpload(route, metadata, { key: file.key, url: file.ufsUrl, type: file.type, size: file.size });
    return { url: file.ufsUrl, key: file.key };
  };

const subdomain = z.object({ subdomain: z.string().min(1).max(63) });

export const fileRouter = {
  productImage: f({ image: { maxFileSize: "8MB", maxFileCount: 10 } }).middleware(guard("productImage")).onUploadComplete(done("productImage")),
  brandAsset: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } }).middleware(guard("brandAsset")).onUploadComplete(done("brandAsset")),
  platformReceipt: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } }).middleware(guard("platformReceipt")).onUploadComplete(done("platformReceipt")),
  transferProof: f({ image: { maxFileSize: "8MB", maxFileCount: 1 } }).input(subdomain).middleware(guard("transferProof")).onUploadComplete(done("transferProof")),
  customerReviewImage: f({ image: { maxFileSize: "4MB", maxFileCount: 3 } }).input(subdomain).middleware(guard("customerReviewImage")).onUploadComplete(done("customerReviewImage")),
  merchantAvatar: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } }).middleware(guard("merchantAvatar")).onUploadComplete(done("merchantAvatar")),
  // استمارة طلب المتجر: أنواع الصور صراحةً (لا SVG)، والصوت "audio" العام (webm على Chrome وmp4 على Safari).
  intakeImage: f({
    "image/jpeg": { maxFileSize: "8MB", maxFileCount: 1 },
    "image/png": { maxFileSize: "8MB", maxFileCount: 1 },
    "image/webp": { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .input(z.object({ token: z.string().max(64), kind: z.enum(["image", "logo"]) }))
    .middleware(guard("intakeImage"))
    .onUploadComplete(done("intakeImage")),
  intakeVoice: f({ audio: { maxFileSize: "8MB", maxFileCount: 1 } })
    .input(z.object({ token: z.string().max(64), durationMs: z.number().int().min(0).max(10 * 60_000).optional() }))
    .middleware(guard("intakeVoice"))
    .onUploadComplete(done("intakeVoice")),
} satisfies FileRouter;

export type AppFileRouter = typeof fileRouter;
