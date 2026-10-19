"use client";

// DeliveryList — قائمة «بانتظار التسليم» (V3 A6): متاجر أنشأها الوكيل بعد موافقة العميل ولم يكتمل إعدادها. لكل متجر نسخ رسالة
// الإعداد بضغطة، وفتح المحادثة، وتعليم الرابط مُسلَّماً بعد إرساله بوسيلة أخرى.
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, CheckCircle2, Copy, MessagesSquare } from "lucide-react";
import { markSetupDeliveredAction } from "@/server/actions/platform-conv";

export type DeliveryItem = {
  storeId: string;
  storeName: string;
  subdomain: string;
  email: string | null;
  createdAt: string;
  linkSentAt: string | null;
  conversationId: string | null;
  person: string | null;
  channel: string | null;
  setupMessage: string;
  loginMessage: string;
};

const BTN = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]/60 disabled:opacity-40";
const GHOST = `${BTN} border-white/10 bg-white/[.04] text-[#c3cdf0] hover:bg-white/10 hover:text-[#eaf0ff]`;
const PRIMARY = `${BTN} border-[#6f86ff]/40 bg-[#6f86ff]/25 text-[#eaf0ff] hover:bg-[#6f86ff]/35`;

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 6e4));
  return m < 60 ? `منذ ${m} دقيقة` : m < 1440 ? `منذ ${Math.round(m / 60)} ساعة` : `منذ ${Math.round(m / 1440)} يوم`;
};

function Row({ item }: { item: DeliveryItem }) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<"setup" | "login" | null>(null);
  const [sent, setSent] = useState(item.linkSentAt);

  const copy = async (which: "setup" | "login") => {
    try {
      await navigator.clipboard.writeText(which === "setup" ? item.setupMessage : item.loginMessage);
      setCopied(which);
      toast.success("نُسخت الرسالة");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("تعذر النسخ");
    }
  };

  return (
    <li className="rounded-2xl border border-white/10 bg-[#0b0f2a] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-black text-white">{item.storeName}</h3>
          <p className="mt-0.5 text-[11.5px] text-slate-400">
            <bdi dir="ltr" className="font-mono">{item.subdomain}</bdi>
            {item.email ? (
              <>
                {" · "}
                <bdi dir="ltr" className="font-mono">{item.email}</bdi>
              </>
            ) : null}
          </p>
          <p className="mt-0.5 text-[11.5px] text-slate-500">
            {item.person ? `${item.person} على ${item.channel === "instagram" ? "إنستجرام" : "ماسنجر"} · ` : ""}أُنشئ {ago(item.createdAt)}
          </p>
        </div>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-bold ${sent ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200"}`}>
          {sent ? `سُلِّم ${ago(sent)}` : "لم يُسلَّم بعد"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => copy("setup")} className={PRIMARY}>
          {copied === "setup" ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />} نسخ رسالة الإعداد
        </button>
        <button type="button" onClick={() => copy("login")} className={GHOST}>
          {copied === "login" ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />} نسخ طريقة الدخول
        </button>
        {item.conversationId ? (
          <Link href={`/admin/conversations?id=${item.conversationId}`} className={GHOST}>
            <MessagesSquare className="size-3.5" aria-hidden="true" /> فتح المحادثة
          </Link>
        ) : null}
        {!sent ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await markSetupDeliveredAction(item.storeId);
                if ("error" in r && r.error) return void toast.error(r.error);
                setSent(new Date().toISOString());
                toast.success("عُلِّم مُسلَّماً، وبدأت التذكيرات من الآن");
              })
            }
            className={GHOST}
          >
            <CheckCircle2 className="size-3.5" aria-hidden="true" /> أرسلتها بنفسي
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function DeliveryList({ items, empty }: { items: DeliveryItem[]; empty: string }) {
  if (!items.length) return <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <Row key={i.storeId} item={i} />
      ))}
    </ul>
  );
}
