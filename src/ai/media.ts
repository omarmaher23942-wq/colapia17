import "server-only";
import { UTApi } from "uploadthing/server";
import { transcribe } from "./providers";
const utapi = new UTApi();
export type InAttachment = { type: string; url?: string };
export type ProcessedAttachment = { type: "image" | "audio" | "video" | "file"; url: string; utUrl?: string; transcript?: string };

/** روابط Meta تنتهي صلاحيتها خلال ساعات؛ نعيد رفع الصور فورًا ليبقى المنتج بصورته للأبد، ونفرّغ الصوت نصًا */
export async function processAttachments(atts: InAttachment[], meta: { conversationId: string }): Promise<ProcessedAttachment[]> {
  const out: ProcessedAttachment[] = [];
  for (const a of atts) { if (!a.url) continue;
    if (a.type === "image") { try { const r = await utapi.uploadFilesFromUrl(a.url); out.push({ type: "image", url: a.url, utUrl: r.data?.ufsUrl ?? r.data?.url }); } catch { out.push({ type: "image", url: a.url }); } }
    else if (a.type === "audio") out.push({ type: "audio", url: a.url, transcript: await transcribe(a.url, { purpose: "transcribe", conversationId: meta.conversationId }) });
    else out.push({ type: a.type === "video" ? "video" : "file", url: a.url });
  }
  return out;
}
