import "server-only";
// uploader.ts — رفع ملفات استمارة الطلب (صور المنتجات والشعار والرسالة الصوتية) بلا تسجيل دخول.
// الهوية = رابط التعديل السري للمسودة. كل ملف يُسجَّل في store_request_assets، والإرسال لا يقبل إلا مفاتيح
// مسجلة لنفس الطلب (منع إرفاق ملف طلب آخر أو رابط خارجي). أنواع الصور محددة صراحةً (لا SVG ولا أي image/*).
import type { createUploadthing } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { storeRequestAssets } from "@/db/schema/agency";
import { clientIp, ipBucket } from "@/lib/client-ip";
import { draftIsOpen, findByDraftToken } from "./repo";
import { hit } from "./guard";

export const MAX_IMAGES_PER_REQUEST = 60;
export const MAX_VOICE_PER_REQUEST = 6;

type F = ReturnType<typeof createUploadthing>;

async function openDraft(token: string) {
  const row = await findByDraftToken(token).catch(() => null);
  if (!row || !draftIsOpen(row)) throw new UploadThingError("رابط الاستمارة غير صالح أو انتهت صلاحيته، حدّث الصفحة.");
  return row;
}

export function intakeImageRoute(f: F) {
  return f({
    "image/jpeg": { maxFileSize: "8MB", maxFileCount: 1 },
    "image/png": { maxFileSize: "8MB", maxFileCount: 1 },
    "image/webp": { maxFileSize: "8MB", maxFileCount: 1 },
  })
    .input(z.object({ token: z.string().max(64), kind: z.enum(["image", "logo"]) }))
    .middleware(async ({ req, input }) => {
      const row = await openDraft(input.token);
      const ip = ipBucket(clientIp(req.headers));
      if (!(await hit(`up:req:${row.id}`, 80, 3600)) || !(await hit(`up:ip:${ip}`, 150, 3600))) {
        throw new UploadThingError("رفع كتير في وقت قصير، استنى دقيقة وكمّل.");
      }
      const [c] = await db
        .select({ n: count() })
        .from(storeRequestAssets)
        .where(and(eq(storeRequestAssets.requestId, row.id), eq(storeRequestAssets.kind, input.kind)));
      if ((c?.n ?? 0) >= (input.kind === "logo" ? 10 : MAX_IMAGES_PER_REQUEST)) throw new UploadThingError("وصلت للحد الأقصى من الصور في الطلب.");
      return { requestId: row.id, kind: input.kind };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await db
        .insert(storeRequestAssets)
        .values({ requestId: metadata.requestId, key: file.key, url: file.ufsUrl, kind: metadata.kind, mime: file.type, sizeBytes: file.size })
        .onConflictDoNothing({ target: storeRequestAssets.key });
      return { key: file.key, url: file.ufsUrl };
    });
}

export function intakeVoiceRoute(f: F) {
  // "audio" العام يطابق audio/webm;codecs=opus (Chrome) وaudio/mp4 (Safari)؛ النوع الدقيق يُحفظ للتفريغ.
  return f({ audio: { maxFileSize: "8MB", maxFileCount: 1 } })
    .input(z.object({ token: z.string().max(64), durationMs: z.number().int().min(0).max(10 * 60_000).optional() }))
    .middleware(async ({ req, input }) => {
      const row = await openDraft(input.token);
      const ip = ipBucket(clientIp(req.headers));
      if (!(await hit(`upv:req:${row.id}`, 12, 3600)) || !(await hit(`upv:ip:${ip}`, 30, 3600))) {
        throw new UploadThingError("محاولات تسجيل كتير، استنى دقيقة وكمّل.");
      }
      const [c] = await db
        .select({ n: count() })
        .from(storeRequestAssets)
        .where(and(eq(storeRequestAssets.requestId, row.id), eq(storeRequestAssets.kind, "voice")));
      if ((c?.n ?? 0) >= MAX_VOICE_PER_REQUEST) throw new UploadThingError("وصلت للحد الأقصى من الرسائل الصوتية في الطلب.");
      return { requestId: row.id, durationMs: input.durationMs ?? null };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      await db
        .insert(storeRequestAssets)
        .values({ requestId: metadata.requestId, key: file.key, url: file.ufsUrl, kind: "voice", mime: file.type, sizeBytes: file.size, durationMs: metadata.durationMs })
        .onConflictDoNothing({ target: storeRequestAssets.key });
      return { key: file.key, url: file.ufsUrl };
    });
}
