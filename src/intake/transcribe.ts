import "server-only";
// transcribe.ts — تفريغ رسالة الاستمارة الصوتية. الملف يجب أن يكون مسجلاً لنفس الطلب ومن مضيف UploadThing
// (لا يُجلب أي رابط يرسله المتصفح)، والتفريغ محدود العدد لأنه يشارك مفتاح Groq مع وكيل الرسائل.
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storeRequestAssets } from "@/db/schema/agency";
import { isTrustedUploadUrl } from "@/lib/upload-hosts";
import { transcribeAudio } from "@/ai/providers";

export type VoiceTranscript = { ok: true; text: string } | { ok: false; error: "not_found" | "failed" | "empty" };

export async function transcribeRequestVoice(requestId: string, key: string): Promise<VoiceTranscript> {
  const [asset] = await db
    .select()
    .from(storeRequestAssets)
    .where(and(eq(storeRequestAssets.requestId, requestId), eq(storeRequestAssets.key, key), eq(storeRequestAssets.kind, "voice")))
    .limit(1);
  if (!asset || !isTrustedUploadUrl(asset.url)) return { ok: false, error: "not_found" };
  if (asset.transcriptStatus === "done" && asset.transcript) return { ok: true, text: asset.transcript };

  await db.update(storeRequestAssets).set({ transcriptStatus: "pending" }).where(eq(storeRequestAssets.id, asset.id));
  const r = await transcribeAudio(asset.url, { purpose: "intake_transcribe" }, { mime: asset.mime });
  await db
    .update(storeRequestAssets)
    .set(r.ok ? { transcript: r.text.slice(0, 4000), transcriptStatus: "done" } : { transcriptStatus: "failed" })
    .where(eq(storeRequestAssets.id, asset.id));
  if (r.ok) return { ok: true, text: r.text.slice(0, 4000) };
  return { ok: false, error: r.error === "empty" ? "empty" : "failed" };
}
