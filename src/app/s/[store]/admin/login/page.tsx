// s/[store]/admin/login/page.tsx — لم يبقَ صفحة دخول مستقلة.
//
// السبب الجذري:
// وجود صفحة دخول على النطاق الفرعي كان يفتح مسار مصادقة ثانياً للتاجر نفسه،
// فينتج عنه جلستان (clp_m مكررة على subdomain آخر). القرار: صفحة الدخول
// الوحيدة للتاجر = colapia.com/login. هذا الملف يحوّل دائماً.
import { redirect } from "next/navigation";
import { clientEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminLoginRedirect() {
  redirect(`${clientEnv.NEXT_PUBLIC_APP_URL}/login`);
}