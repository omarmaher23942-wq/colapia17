// /admin/activate على نطاق المتجر: رابط قديم في رسائل التجميد وبوابة المتجر المجمّد. الدفع صار في صفحة واحدة
// على المنصة (/dashboard/billing) حيث جلسة التاجر، فهذا المسار يحوّل إليها فقط.
import { redirect } from "next/navigation";
import { clientEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function ActivatePage() {
  redirect(`${clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/dashboard/billing`);
}
