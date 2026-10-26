// dashboard/activate — «تفعيل الموقع»: الدفع من صفحة الاشتراك، ثم «ربط حساباتكم» (قاعدة، مفاتيح، مستودع، نشر) وحجز الميتنج.
import type { Metadata } from "next";
import Link from "next/link";
import { requireStoreArea } from "@/server/merchant-guard";
import { viewFrom } from "@/lib/connections";
import { waLink } from "@/lib/whatsapp";
import { env } from "@/lib/env";
import { ConnectAccounts } from "@/components/dashboard/activate/ConnectAccounts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "تفعيل الموقع" };

export default async function ActivatePage() {
  const s = await requireStoreArea("billing");
  const owner = s.access === "owner";
  const meeting = waLink(env.AGENCY_WHATSAPP, `أريد حجز ميتنج ربط الحسابات لمتجر «${s.store.name}»`);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-[22px] font-black text-ink">تفعيل الموقع</h1>
        <p className="mt-1 text-[13px] leading-6 text-ink-3">خطوتان: ادفعوا لتفعيل الموقع، ثم اربطوا حساباتكم ليصبح كل شيء باسمكم. نجلس معكم في الميتنج حتى تكتمل.</p>
        <Link href="/dashboard/billing" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-nova px-5 text-[13.5px] font-black text-white dark:text-space">
          فعّلوا الموقع
        </Link>
      </header>
      {owner ? (
        <>
          <h2 className="text-[17px] font-black text-ink">ربط حساباتكم</h2>
          <ConnectAccounts view={viewFrom(s.store.prefs)} meetingHref={meeting} />
        </>
      ) : (
        <p className="text-[13px] text-ink-3">ربط الحسابات متاح لصاحب المتجر وحده.</p>
      )}
    </div>
  );
}
