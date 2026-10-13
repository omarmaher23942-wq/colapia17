// media-host.ts — مساحة رفع الصور في متجرك: حساب UploadThing الخاص بك (المفتاح من «الربط والمفاتيح»).
// نفس واجهة نسخة المنصة (upload/remove) حتى تعمل صفحات اللوحة المشتركة كما هي.
import "server-only";
import { UTApi, UTFile } from "uploadthing/server";
import { providerKey } from "@/server/settings";

export type MediaHost = {
  upload(file: { bytes: Uint8Array; name: string; type: string; ext: string; prefix: string }): Promise<{ url: string; key: string } | null>;
  remove(keys: string[]): Promise<boolean>;
};

export async function mediaApi(): Promise<MediaHost | null> {
  const token = await providerKey("uploadthing");
  if (!token) return null;
  const api = new UTApi({ token });
  return {
    async upload(f) {
      const up = await api.uploadFiles(new UTFile([f.bytes as Uint8Array<ArrayBuffer>], f.name, { type: f.type })).catch(() => null);
      return up?.data?.ufsUrl ? { url: up.data.ufsUrl, key: up.data.key } : null;
    },
    async remove(keys) {
      for (let i = 0; i < keys.length; i += 100) {
        const res = await api.deleteFiles(keys.slice(i, i + 100)).catch(() => null);
        if (!res?.success) return false;
      }
      return true;
    },
  };
}
