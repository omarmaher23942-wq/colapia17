// /no-store — حساب سجّل الدخول لكن لا متجر مرتبط به. شاشة لطيفة بتبديل الحساب (لا /login: يعيد من له جلسة إلى اللوحة فتدور حلقة).
import type { Metadata } from "next";
import { AuthNotice, AuthShell, AUTH_BTN } from "@/components/auth/AuthShell";
import { merchantLogoutAction } from "@/server/actions/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "لا يوجد متجر مرتبط", robots: { index: false, follow: false } };

export default function NoStorePage() {
  return (
    <AuthShell>
      <AuthNotice
        title="لا يوجد متجر مرتبط بهذا الحساب"
        action={
          <form action={merchantLogoutAction}>
            <button type="submit" className={AUTH_BTN}>
              الدخول بحساب آخر
            </button>
          </form>
        }
      >
        <p>ادخلوا بالبريد الذي سجّلتموه معنا. وإن لم يصلكم رابط إعداد متجركم فراسلونا في المحادثة نفسها.</p>
      </AuthNotice>
    </AuthShell>
  );
}
