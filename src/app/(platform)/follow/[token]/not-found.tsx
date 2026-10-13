// رابط متابعة غير صالح (خطأ في النسخ، أو الطلب عُلّم سبام/مسحوب): رسالة واضحة وقناة تواصل بدل 404 صامت.
import Link from "next/link";
import { ColapiaLogo } from "@/components/brand/ColapiaLogo";
import { ContactHelp } from "@/components/intake/ContactHelp";
import { agencyWhatsappUrl } from "@/intake/notify";

export const metadata = { title: "الرابط مش صحيح | Colapia", robots: { index: false, follow: false } };

export default function FollowNotFound() {
  return (
    <div dir="rtl" className="dash dark dash-cosmos relative min-h-dvh text-ink">
      <div className="border-b border-edge/[0.06] bg-space/70">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <ColapiaLogo size={28} />
        </div>
      </div>
      <main className="mx-auto max-w-lg space-y-4 px-4 py-12 text-center">
        <h1 className="text-[24px] font-black text-ink">الرابط ده مش صحيح</h1>
        <p className="text-[14.5px] leading-7 text-ink-2">ممكن يكون اتقطع جزء منه وقت النسخ. افتحه تاني من الرسالة أو البريد اللي وصلك، ولو لسه مش شغال راسلنا برقم طلبك.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <ContactHelp whatsappUrl={agencyWhatsappUrl("أهلاً، رابط متابعة طلب متجري مش شغال")} />
          <Link href="/start" className="inline-flex min-h-11 items-center rounded-xl border border-edge/15 px-4 text-[14px] font-black text-ink hover:border-edge/30">
            ابدأ طلب جديد
          </Link>
        </div>
      </main>
    </div>
  );
}
