import "server-only";
// owner.ts — الإعداد الأول: إنشاء حساب صاحب المتجر ومتجره (مرة واحدة)، ورمز الاسترجاع.
//  - البريد ثابت من إعداد المشروع (STORE.ownerEmail) ولا يُطلب في الصفحة، فلا يمكن لغريب فتح حساب ببريد آخر.
//  - الإنشاء مرة واحدة: بعد وجود أي متجر لا تعمل الدالة.
//  - SETUP_CODE (اختياري): إن ضُبط في Cloudflare فهو شرط لإنشاء الحساب، وهو ما يمنع غريباً وصل للرابط قبلكم.
//  - رمز الاسترجاع يظهر مرة واحدة فقط ويُحفظ مجزّأً (SHA-256).
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { merchants, shippingZones, storeBlueprints, storeSettings, stores } from "@/db/schema";
import { blueprintSchema } from "@/blueprint/schema";
import { defaultShippingZones } from "@/lib/egypt";
import { canonicalEmail } from "@/lib/contact";
import { sha256 } from "@/lib/ids";
import { secretsEqual, hashPassword } from "@/server/passwords";
import { setOwnerPassword, startOwnerSession } from "@/server/auth";
import { STORE } from "@/store.config";
import seed from "../../../store/blueprint.json";

export const MIN_OWNER_PASSWORD = 10;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** رمز استرجاع من 16 حرفاً بلا حروف ملتبسة، بصيغة XXXX-XXXX-XXXX-XXXX. */
export function newRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]!).join("");
  return chars.match(/.{4}/g)!.join("-");
}

export const normalizeRecovery = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

async function storeRecovery(code: string): Promise<void> {
  const value = { hash: await sha256(normalizeRecovery(code)), createdAt: new Date().toISOString() };
  await db
    .insert(storeSettings)
    .values({ key: "owner.recovery", value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value, updatedAt: new Date() } });
}

export type SetupResult = { ok: true; recoveryCode: string } | { ok: false; error: string };

/** يتحقق من رمز الإعداد إن كان مشروطاً. */
export function setupCodeOk(given: string | null | undefined): boolean {
  const required = process.env.SETUP_CODE?.trim();
  if (!required) return true;
  return secretsEqual(required, (given ?? "").trim());
}

export async function createOwnerAndStore(input: { password: string }): Promise<SetupResult> {
  if (input.password.length < MIN_OWNER_PASSWORD) return { ok: false, error: `كلمة المرور ${MIN_OWNER_PASSWORD} أحرف على الأقل.` };
  const existing = await db.select({ id: stores.id }).from(stores).limit(1);
  if (existing.length) return { ok: false, error: "تم الإعداد من قبل. ادخلوا من صفحة الدخول." };

  const bp = blueprintSchema.parse(seed);
  const merchantId = randomUUID();
  const storeId = randomUUID();
  const now = new Date();
  const email = STORE.ownerEmail;
  try {
    await db.batch([
      db.insert(merchants).values({
        id: merchantId,
        displayName: STORE.name,
        email,
        emailCanonical: canonicalEmail(email),
        passwordHash: await hashPassword(input.password),
        isActivated: true,
      }),
      db.insert(stores).values({
        id: storeId,
        merchantId,
        subdomain: STORE.slug,
        name: STORE.name,
        status: "setup",
        setupStartedAt: now,
        onboarding: { step: "welcome", done: [], niche: STORE.niche, startedAt: now.toISOString() },
      }),
      db.insert(storeBlueprints).values({ storeId, data: bp, updatedBy: "setup" }),
      db.insert(shippingZones).values(defaultShippingZones().map((z) => ({ ...z, storeId }))),
    ]);
  } catch (e) {
    console.error("[setup] create owner failed", e);
    return { ok: false, error: "تعذّر إنشاء الحساب. تأكدوا من تجهيز قاعدة البيانات أولاً ثم أعيدوا المحاولة." };
  }
  const recoveryCode = newRecoveryCode();
  await storeRecovery(recoveryCode);
  await startOwnerSession(merchantId, storeId);
  return { ok: true, recoveryCode };
}

/** استرجاع الدخول برمز الاسترجاع: يعيد تعيين كلمة المرور ويُصدر رمزاً جديداً (القديم يبطل). */
export async function recoverOwner(input: { code: string; password: string }): Promise<SetupResult> {
  if (input.password.length < MIN_OWNER_PASSWORD) return { ok: false, error: `كلمة المرور ${MIN_OWNER_PASSWORD} أحرف على الأقل.` };
  const [row] = await db.select({ value: storeSettings.value }).from(storeSettings).where(eq(storeSettings.key, "owner.recovery")).limit(1);
  const stored = (row?.value as { hash?: string } | undefined)?.hash;
  if (!stored || !secretsEqual(stored, await sha256(normalizeRecovery(input.code)))) return { ok: false, error: "رمز الاسترجاع غير صحيح." };
  const [store] = await db.select({ id: stores.id, merchantId: stores.merchantId }).from(stores).limit(1);
  if (!store) return { ok: false, error: "لا متجر مُعدّ بعد." };
  await setOwnerPassword(store.merchantId, input.password);
  const recoveryCode = newRecoveryCode();
  await storeRecovery(recoveryCode);
  await startOwnerSession(store.merchantId, store.id);
  return { ok: true, recoveryCode };
}
