// settings.ts — إعدادات مشروعك في قاعدتك (جدول store_settings): كلمة مرور صاحب المتجر ورمز الاسترجاع، ومفاتيحك التي
// تدخلها من «الربط والمفاتيح»، وحالة الإعداد الأول. المفتاح يُقرأ من متغيرات البيئة أولاً ثم مما أدخلته في اللوحة.
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storeSettings } from "@/db/schema";
import { cleanSecretValue } from "@/lib/env";

export type SettingKey = "keys.groq" | "keys.resend" | "keys.meta_capi" | "owner.recovery" | "setup";

export async function getSetting<T>(key: SettingKey): Promise<T | null> {
  const [row] = await db.select({ value: storeSettings.value }).from(storeSettings).where(eq(storeSettings.key, key)).limit(1);
  return (row?.value as T | undefined) ?? null;
}

export async function setSetting(key: SettingKey, value: unknown): Promise<void> {
  await db
    .insert(storeSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value, updatedAt: new Date() } });
}

export async function deleteSetting(key: SettingKey): Promise<void> {
  await db.delete(storeSettings).where(eq(storeSettings.key, key));
}

/** مفتاح مزوّد: من متغيرات البيئة أولاً (Cloudflare)، ثم مما أدخلته في لوحة التحكم. */
export async function providerKey(name: "groq" | "resend"): Promise<string | null> {
  const env = cleanSecretValue(name === "groq" ? process.env.GROQ_API_KEY : process.env.RESEND_API_KEY);
  if (env) return env;
  return (await getSetting<string>(`keys.${name}`).catch(() => null)) || null;
}

export const maskKey = (k: string | null) => (k ? `••••${k.slice(-4)}` : null);
