import { createUploadthing } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { onboardingAssets } from "@/db/schema";
import { findSessionByToken } from "./sessions";
import { rateLimit } from "./guard";

const MAX_ASSETS_PER_CONVERSATION = 200;

/**
 * الاستخدام:  onboardingImage: onboardingImageRoute(f)
 * يُسجَّل كل ملف في onboarding_assets، وعند الإرسال نقبل فقط المفاتيح الموجودة هنا (منع التزوير).
 */
export function onboardingImageRoute(f: ReturnType<typeof createUploadthing>) {
  return f({ image: { maxFileSize: "8MB", maxFileCount: 1 } })
    .input(z.object({ token: z.string().max(64) }))
    .middleware(async ({ input }) => {
      const s = await findSessionByToken(input.token);
      if (!s || (s.status !== "issued" && s.status !== "draft")) throw new UploadThingError("الرابط غير صالح أو انتهت صلاحيته");
      if (!(await rateLimit(`onb:up:${s.id}`, 60, 600))) throw new UploadThingError("رفع كتير في وقت قصير، استنى شوية");
      const [c] = await db.select({ n: count() }).from(onboardingAssets).where(eq(onboardingAssets.conversationId, s.conversationId));
      if ((c?.n ?? 0) >= MAX_ASSETS_PER_CONVERSATION) throw new UploadThingError("وصلت للحد الأقصى من الصور");
      return { conversationId: s.conversationId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const url = file.ufsUrl;
      await db
        .insert(onboardingAssets)
        .values({ conversationId: metadata.conversationId, key: file.key, url, mime: file.type, sizeBytes: file.size })
        .onConflictDoNothing({ target: onboardingAssets.key });
      return { key: file.key, url };
    });
}