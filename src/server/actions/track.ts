"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getBlueprint, getStoreBySubdomain } from "@/lib/tenant";
import { orderCodeCandidates } from "@/lib/order-code";
import { getOrderByCodeAndPhone } from "@/server/repos/orders";
import { grantOrderAccess } from "@/lib/order-access";
import { allow, clientIp } from "@/lib/ratelimit";

const CODE_RE = /^[A-Z0-9#-]{2,20}$/;

/**
 * تتبع الطلب بـ POST: الموبايل لا يظهر في الرابط أبدًا.
 * عند التطابق نمنح cookie الطلب ونعيد التوجيه لصفحة التتبع بالكود فقط.
 */
export async function trackOrderAction(subdomain: string, formData: FormData): Promise<void> {
  const h = await headers();
  const sub = String(subdomain ?? "").toLowerCase();
  const path = (h.get("x-pathname") ?? "").toLowerCase();
  const internal = path === `/s/${sub}` || path.startsWith(`/s/${sub}/`);
  const base = internal ? `/s/${sub}` : "";

  let code = String(formData.get("code") ?? "").trim().toUpperCase().slice(0, 20);
  const phone = String(formData.get("phone") ?? "").slice(0, 30);
  const back = (e?: "notfound" | "limited") =>
    redirect(`${base}/track?code=${encodeURIComponent(code)}${e ? `&e=${e}` : ""}`);

  if (!CODE_RE.test(code) || !phone.trim()) return back("notfound");
  if (!(await allow("track", clientIp(h)))) return back("limited");

  const store = await getStoreBySubdomain(sub);
  if (!store) return back("notfound");

  // يقبل «1042» بلا بادئة المتجر.
  const bp = await getBlueprint(store.id);
  let o = null;
  for (const c of orderCodeCandidates(code, bp.invoice.orderPrefix)) {
    o = await getOrderByCodeAndPhone(store.id, c, phone);
    if (o) break;
  }
  if (!o) return back("notfound");

  await grantOrderAccess(store.id, o.code);
  code = o.code;
  return back();
}
