"use client";

// FollowActions.tsx — حفظ رابط المتابعة: نسخه، أو إرساله لنفس العميل على واتساب (البريد اختياري في الاستمارة،
// ومتصفح إنستجرام الداخلي ينسى الصفحة عند إغلاقه).
import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export function FollowActions({ code, storeName }: { code: string; storeName: string }) {
  const [copied, setCopied] = useState(false);
  const url = () => window.location.href.split("?")[0]!;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      toast.success("الرابط اتنسخ. احفظه عندك.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.message(url());
    }
  };

  const share = () => {
    const text = `رابط متابعة متجري «${storeName}» من Colapia (طلب ${code}):\n${url()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => void copy()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-edge/15 px-4 text-[14px] font-black text-ink hover:border-edge/30">
        {copied ? <Check className="size-4 text-emerald-400" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        انسخ الرابط
      </button>
      <button type="button" onClick={share} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-[14px] font-black text-[#062b15]">
        <MessageCircle className="size-4" aria-hidden="true" />
        ابعته لنفسك على واتساب
      </button>
    </div>
  );
}
