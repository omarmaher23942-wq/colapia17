"use server";
// connections.ts — حفظ مفاتيح «ربط حساباتكم» وبدء نقل البيانات. لصاحب المتجر وحده. القيم تُفحص وتُشفَّر ولا تُعاد.
import { revalidatePath } from "next/cache";
import { ownerStore } from "@/server/merchant-guard";
import { checkSecret, SECRET_FIELDS, type SecretField } from "@/lib/connections";
import { saveConnectionSecret, readConnectionSecret } from "@/server/connections";
import { startTransfer } from "@/server/transfer";

type R = { ok: true } | { ok: false; error: string };
const GONE = "انتهت جلستكم، سجّلوا الدخول من جديد.";

export async function saveConnectionAction(field: SecretField, raw: string): Promise<R> {
  const s = await ownerStore({ allowLocked: true });
  if (!s) return { ok: false, error: GONE };
  if (!(SECRET_FIELDS as readonly string[]).includes(field)) return { ok: false, error: "حقل غير معروف." };
  const c = checkSecret(field, String(raw ?? ""));
  if (!c.ok) return c;
  await saveConnectionSecret(s.storeId, field, c.value);
  revalidatePath("/dashboard/activate");
  return { ok: true };
}

export async function startTransferAction(): Promise<R> {
  const s = await ownerStore({ allowLocked: true });
  if (!s) return { ok: false, error: GONE };
  const url = await readConnectionSecret(s.storeId, "neonUrl");
  if (!url) return { ok: false, error: "احفظوا رابط القاعدة أولاً." };
  const r = await startTransfer(s.storeId, url);
  if (r.ok) return r;
  return { ok: false, error: r.error === "not_ready" ? "نقل البيانات يتم مع الفريق في الميتنج بعد التفعيل؛ سنخبركم عند جاهزيته." : r.error };
}
