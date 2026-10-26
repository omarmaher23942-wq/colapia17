import "server-only";
// store-secrets.ts (مشروعك الخاص) — رمز Conversions API من ميتا في جدول store_settings بقاعدتك.
import { deleteSetting, getSetting, setSetting } from "@/server/settings";

export async function metaCapiToken(_storeId: string): Promise<string | null> {
  return (await getSetting<string>("keys.meta_capi").catch(() => null)) || null;
}

export async function setMetaCapiToken(_storeId: string, token: string | null): Promise<void> {
  if (token) await setSetting("keys.meta_capi", token);
  else await deleteSetting("keys.meta_capi");
}
