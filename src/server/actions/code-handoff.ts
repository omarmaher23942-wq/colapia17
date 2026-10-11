"use server";
// code-handoff.ts — صاحب متجر مدفوع يطلب نسخة كاملة من كود متجره وبياناته (المرحلة 7، قرار مُراجَع: التسليم بيد
// الفريق بدل نقل ذاتي عبر GitHub/Vercel/Neon لعميل لا تهمه التقنية). يُسجَّل الطلب ويُبلَّغ الفريق، والفريق ينزّل
// المشروع من صفحة المتجر في لوحته ويسلّمه بدليل تشغيله.
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { storeActivity } from "@/db/schema";
import { ownerStore } from "@/server/merchant-guard";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { allow } from "@/lib/ratelimit";

export async function requestCodeHandoffAction(note?: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const s = await ownerStore();
  if (!s) return { ok: false, error: "الطلب لصاحب المتجر." };
  if (s.store.status !== "active") return { ok: false, error: "تسليم الكود متاح بعد دفع الباقة." };
  if (!(await allow("ownership", `handoff:${s.storeId}`))) return { ok: false, error: "سجلنا طلبك بالفعل. انتظر تواصل الفريق." };
  const clean = (note ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  await db.insert(storeActivity).values({ storeId: s.storeId, merchantId: s.merchantId, action: "code.requested", target: clean || null });
  await notifyAdmin(`طلب تسليم كود: متجر ${s.store.subdomain} (${s.store.name}). نزّل المشروع من صفحة المتجر في اللوحة وسلّمه للعميل.${clean ? ` ملاحظته: ${clean}` : ""}`, { storeId: s.storeId }).catch(() => {});
  revalidatePath("/dashboard/own");
  return { ok: true };
}
