// media-host.ts — مساحة الملفات التي يكتب فيها الخادم أو يحذف منها (نقل صور ملف الاستيراد، حذف ملفات متجر أو طلب).
// على المنصة: R2 متى ضُبطت مفاتيحه (server/r2.ts)، وإلا حساب UploadThing الخاص بالمنصة. الحذف يفرّق بنفسه بين
// مفتاح R2 (مسار فيه «/») ومفتاح UploadThing القديم.
import "server-only";
import { randomUUID } from "node:crypto";
import { UTApi, UTFile } from "uploadthing/server";
import { env } from "@/lib/env";
import { deleteObjects, putObject, r2Configured } from "@/server/r2";

export type MediaHost = {
  /** يرفع ملفاً ويعيد رابطه العام ومفتاحه، أو null عند الفشل. */
  upload(file: { bytes: Uint8Array; name: string; type: string; ext: string; prefix: string }): Promise<{ url: string; key: string } | null>;
  /** يحذف الملفات؛ true فقط إن نجح الحذف كله (مفتاح محذوف سابقاً نجاح). */
  remove(keys: string[]): Promise<boolean>;
};

const ut = () => (env.UPLOADTHING_TOKEN ? new UTApi({ token: env.UPLOADTHING_TOKEN }) : null);

async function removeUt(keys: string[]): Promise<boolean> {
  if (!keys.length) return true;
  const api = ut();
  if (!api) return false;
  for (let i = 0; i < keys.length; i += 100) {
    const res = await api.deleteFiles(keys.slice(i, i + 100)).catch(() => null);
    if (!res?.success) return false;
  }
  return true;
}

export async function mediaApi(): Promise<MediaHost | null> {
  if (r2Configured()) {
    return {
      async upload(f) {
        const key = `${f.prefix}/${randomUUID()}.${f.ext}`;
        try {
          return { url: await putObject(key, f.bytes, f.type), key };
        } catch (e) {
          console.error("[media-host] r2 upload failed", e);
          return null;
        }
      },
      async remove(keys) {
        const r2 = keys.filter((k) => k.includes("/"));
        const legacy = keys.filter((k) => !k.includes("/"));
        const okR2 = r2.length ? (await deleteObjects(r2)) === r2.length : true;
        return okR2 && (await removeUt(legacy));
      },
    };
  }
  const api = ut();
  if (!api) return null;
  return {
    async upload(f) {
      const up = await api.uploadFiles(new UTFile([f.bytes as Uint8Array<ArrayBuffer>], f.name, { type: f.type })).catch(() => null);
      if (up?.data?.ufsUrl) return { url: up.data.ufsUrl, key: up.data.key };
      if (up?.error) console.error("[media-host] upload", up.error.code, up.error.message);
      return null;
    },
    remove: removeUt,
  };
}
