"use client";

// ShareStoreCard — «ضعوا رابط متجركم في بايو إنستجرام» (D11): الرابط مع نسخ بضغطة وخطوات واضحة ونص جاهز للبايو ورمز QR،
// وتبقى البطاقة في «اليوم» حتى يؤكد التاجر أنه نشر الرابط (وتظل ثابتة في صفحة «رابط متجري»).
import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { markShareDoneAction } from "@/server/actions/growth";

export function ShareStoreCard({ url, storeName, qr, dismissible = true }: { url: string; storeName: string; qr: string; dismissible?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);
  const display = url.replace(/^https?:\/\//, "");
  const bio = `تسوّقوا من ${storeName}\n${display}`;
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error("تعذّر النسخ، حدّدوا النص وانسخوه يدوياً");
    }
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: storeName, text: `تسوّقوا من ${storeName}`, url });
      else await copy("link", url);
    } catch {
      /* أُلغيت المشاركة */
    }
  };
  const done = () =>
    start(async () => {
      const r = await markShareDoneAction().catch(() => ({ ok: false as const, error: "انقطع الاتصال" }));
      if (!r.ok) return void toast.error(r.error);
      router.refresh();
    });

  return (
    <section className="dash-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center" aria-label="مشاركة المتجر">
      {qr ? <Image src={qr} alt="رمز QR لرابط متجركم" width={112} height={112} unoptimized className="size-28 shrink-0 rounded-xl bg-white p-1.5" /> : null}
      <div className="min-w-0 flex-1 space-y-2">
        <h2 className="text-[14px] font-black text-ink">ضعوا رابط متجركم في بايو إنستجرام</h2>
        <ol className="list-decimal space-y-0.5 ps-5 text-[12.5px] leading-6 text-ink-2">
          <li>انسخوا الرابط بالزر أدناه.</li>
          <li>في إنستجرام: «تعديل الملف الشخصي» ثم «الروابط» ثم «إضافة رابط».</li>
          <li>الصقوه واحفظوا، وكرروا الأمر في تيك توك، وأضيفوه لستوري اليوم مع منتج واحد.</li>
        </ol>
        <p className="text-[12px] text-ink-3">
          <Link href="/dashboard/studio" className="font-bold text-nova-2 hover:text-ink">استوديو المحتوى</Link> يجهّز لكم نصوص المنشورات.
        </p>
        <p dir="ltr" className="truncate rounded-lg bg-edge/[0.05] px-3 py-2 text-start text-[12.5px] font-bold text-ink">{display}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => copy("link", url)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-4 text-[13px] font-black text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova-2">
            {copied === "link" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied === "link" ? "تم نسخ الرابط" : "نسخ الرابط"}
          </button>
          <button type="button" onClick={share} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-edge/10 px-4 text-[13px] font-bold text-ink hover:bg-edge/[0.06]">
            <Share2 className="size-4" aria-hidden="true" />
            مشاركة
          </button>
          <button type="button" onClick={() => copy("bio", bio)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-edge/10 px-4 text-[13px] font-bold text-ink hover:bg-edge/[0.06]">
            {copied === "bio" ? <Check className="size-4 text-ok" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            نسخ نص البايو
          </button>
          {dismissible ? (
            <button type="button" disabled={pending} onClick={done} className="min-h-11 rounded-xl px-4 text-[13px] font-bold text-ink-2 hover:bg-edge/[0.06] disabled:opacity-60">
              تم النشر، أخفوا البطاقة
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
