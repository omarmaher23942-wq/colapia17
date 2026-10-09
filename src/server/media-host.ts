// media-host.ts — مساحة رفع الصور التي تكتب فيها اللوحة من الخادم (نقل صور ملف الاستيراد مثلاً).
// على المنصة: حساب UploadThing الخاص بالمنصة (المتجر أثناء التجربة). مشروع التاجر له نسخته بمفتاحه هو (template/).
import "server-only";
import { UTApi } from "uploadthing/server";
import { env } from "@/lib/env";

export async function mediaApi(): Promise<UTApi | null> {
  return env.UPLOADTHING_TOKEN ? new UTApi({ token: env.UPLOADTHING_TOKEN }) : null;
}
