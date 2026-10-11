// store-preview.ts — هل هذا الطلب معاينة فريق؟ (الهيدر يكتبه middleware وحده ويحذف أي نسخة من العميل.)
import "server-only";
import { headers } from "next/headers";
import { PREVIEW_HEADER } from "@/lib/store-preview";

export async function isTeamPreview(): Promise<boolean> {
  return (await headers()).get(PREVIEW_HEADER) === "1";
}
