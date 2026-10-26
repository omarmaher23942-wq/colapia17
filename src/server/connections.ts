import "server-only";
// connections.ts — أسرار «ربط حساباتكم» (قاعدة العميل، مفاتيح الذكاء والصور): تُشفَّر بـ AES-GCM من سر المنصة وتُحفظ في
// stores.prefs.connections، ولا تُقرأ إلا في الخادم (للنقل في N4 وتجهيز مشروع التسليم)، ولا تُعاد للواجهة أبداً.
// ملاحظة: جدول store_secrets بعمود واحد لرمز ميتا؛ نقل هذه الأسرار إليه يحتاج migration (انظر المتابعة).
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { stores } from "@/db/schema";
import { env } from "@/lib/env";
import { openSecret, sealSecret } from "@/lib/secret-box";
import { type SecretField } from "@/lib/connections";

export async function saveConnectionSecret(storeId: string, field: SecretField, value: string): Promise<void> {
  const sealed = sealSecret(env.AUTH_SECRET, value);
  await db
    .update(stores)
    .set({
      prefs: sql`jsonb_set(jsonb_set(coalesce(${stores.prefs}, '{}'::jsonb), '{connections}', coalesce(${stores.prefs}->'connections', '{}'::jsonb), true), ARRAY['connections','secrets',${field}::text], to_jsonb(${sealed}::text), true)`,
      updatedAt: new Date(),
    })
    .where(eq(stores.id, storeId));
}

/** للخادم وحده (النقل والتسليم). null إن لم تُحفظ. */
export async function readConnectionSecret(storeId: string, field: SecretField): Promise<string | null> {
  const [r] = await db.select({ p: stores.prefs }).from(stores).where(eq(stores.id, storeId)).limit(1);
  const c = (r?.p as Record<string, any> | undefined)?.connections?.secrets?.[field]; // eslint-disable-line @typescript-eslint/no-explicit-any
  return openSecret(env.AUTH_SECRET, c);
}
