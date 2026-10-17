// dashboard/setup-pending — ما يراه موظف في فريق متجر لم يكتمل إعداده: صاحب المتجر يكمل «إعداد المتجر» أولاً.
// لا يستخدم requireStoreArea (هو وجهة التحويل منه)، ولا يكشف شيئاً عن المتجر سوى اسمه.
import Link from "next/link";
import { redirect } from "next/navigation";
import { Hourglass } from "lucide-react";
import { getMerchantSession } from "@/server/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "المتجر قيد الإعداد" };

export default async function SetupPendingPage() {
  const session = await getMerchantSession();
  if (!session?.store) redirect("/login?redirect=/dashboard");
  // صاحب المتجر لا يرى هذه الصفحة: يكمل إعداده، أو يدخل لوحته إن اكتمل.
  if (session.access === "owner") redirect(session.store.status === "setup" ? "/onboarding" : "/dashboard");
  if (session.store.status !== "setup") redirect("/dashboard");

  return (
    <main className="mx-auto grid min-h-[70dvh] max-w-md place-items-center px-5 py-16 text-center">
      <div className="dash-card p-8">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-nova/12 text-nova-2">
          <Hourglass className="size-7" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-[20px] font-black text-ink">المتجر قيد الإعداد</h1>
        <p className="mt-2 text-[13.5px] leading-7 text-ink-2">
          صاحب المتجر ما زال يُكمل خطوات الإعداد الأولى. ستُفتح لوحة التحكم لكم بمجرد تفعيل المتجر، وبصلاحياتكم الممنوحة.
        </p>
        <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-edge/15 px-5 text-[13px] font-bold text-ink-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50">
          تحديث الصفحة
        </Link>
      </div>
    </main>
  );
}
