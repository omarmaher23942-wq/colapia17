// /setup بلا رمز: روابط الإعداد صارت /setup/<رمز>. أي رابط قديم يصل هنا فيشرح الصفحة الحال ويحيل إلى الدخول.
import type { Metadata } from "next";
import Link from "next/link";
import { AuthNotice, AuthShell, AUTH_BTN } from "@/components/auth/AuthShell";

export const metadata: Metadata = { title: "إعداد متجركم", robots: { index: false, follow: false } };

export default function SetupIndex() {
  return (
    <AuthShell>
      <AuthNotice
        title="افتحوا رابط الإعداد الذي أرسله الفريق"
        action={
          <Link href="/login" className={AUTH_BTN}>
            صفحة الدخول
          </Link>
        }
      >
        <p>لكل متجر رابط إعداد خاص به. إن لم يصلكم أو انتهت صلاحيته فراسلونا في المحادثة نفسها وسنرسله من جديد.</p>
      </AuthNotice>
    </AuthShell>
  );
}
