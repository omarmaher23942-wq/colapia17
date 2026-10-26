"use server";
// actions.ts — الربط والمفاتيح: اختبار حي لكل خدمة وحفظ مفتاح Groq في قاعدتك بعد اختباره. المفاتيح الأخرى (قاعدة البيانات،
// ImageKit، البريد) متغيرات في Cloudflare ولا تُحفظ في اللوحة أبداً.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ownerStore } from "@/server/merchant-guard";
import { deleteSetting, setSetting } from "@/server/settings";
import { cleanSecretValue } from "@/lib/env";
import { checkImageKit } from "@/server/imagekit";

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const SESSION_ERR = "انتهت الجلسة، سجّلوا الدخول من جديد.";

/** اختبار مفتاح Groq بطلب قراءة قائمة النماذج (لا يستهلك رصيداً). */
async function checkGroq(raw: string): Promise<Result<string>> {
  const key = cleanSecretValue(raw) ?? "";
  if (!/^gsk_[A-Za-z0-9]{20,}$/.test(key)) return { ok: false, error: "مفتاح Groq يبدأ بـ gsk_. انسخوه كاملاً من console.groq.com/keys." };
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
    if (r.status === 401) return { ok: false, error: "Groq رفض المفتاح (غير صحيح أو محذوف)." };
    if (!r.ok) return { ok: false, error: "تعذّر الاتصال بـ Groq الآن. أعيدوا المحاولة بعد دقيقة." };
    return { ok: true, data: key };
  } catch {
    return { ok: false, error: "تعذّر الاتصال بـ Groq الآن. أعيدوا المحاولة بعد دقيقة." };
  }
}

export async function saveGroqKeyAction(raw: unknown): Promise<Result> {
  if (!(await ownerStore())) return { ok: false, error: SESSION_ERR };
  const p = z.string().trim().min(8).max(4000).safeParse(raw);
  if (!p.success) return { ok: false, error: "الصقوا المفتاح كاملاً." };
  const check = await checkGroq(p.data);
  if (!check.ok) return check;
  await setSetting("keys.groq", check.data);
  revalidatePath("/dashboard/integrations");
  return { ok: true, data: null };
}

export async function removeGroqKeyAction(): Promise<Result> {
  if (!(await ownerStore())) return { ok: false, error: SESSION_ERR };
  await deleteSetting("keys.groq");
  revalidatePath("/dashboard/integrations");
  return { ok: true, data: null };
}

export async function testImageKitAction(): Promise<Result> {
  if (!(await ownerStore())) return { ok: false, error: SESSION_ERR };
  const r = await checkImageKit();
  return r.ok ? { ok: true, data: null } : r;
}
