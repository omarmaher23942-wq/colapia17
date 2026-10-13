"use client";

// DomainPanel.tsx — ربط النطاق الخاص بخطوات واضحة: اكتب النطاق ← أضف السجلات ← افحص. لصاحب المتجر (الخادم يفرض).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, Copy, Globe, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { DnsRecord } from "@/lib/custom-domain";
import { checkCustomDomainAction, removeCustomDomainAction, setCustomDomainAction } from "@/server/actions/custom-domain";
import { cn } from "@/lib/utils";

type Props = {
  canEdit: boolean;
  subdomainUrl: string;
  domain: string | null;
  status: "pending" | "awaiting_team" | "active" | null;
  checkedAt: string | null;
  records: DnsRecord[];
  explain: string | null;
  allowed: boolean;
  auto: boolean;
  /** الجذري يُربط بسجل CNAME على @ (Cloudflare): بعض الشركات تسميه ALIAS أو لا تدعمه. */
  apexNeedsCname?: boolean;
};

const STATUS = {
  pending: { label: "بانتظار السجلات", tone: "text-warn", Icon: Clock3 },
  awaiting_team: { label: "يشير إلينا، بانتظار فريقنا", tone: "text-nova-2", Icon: Clock3 },
  active: { label: "يعمل", tone: "text-ok", Icon: CheckCircle2 },
} as const;

export function DomainPanel(p: Props) {
  const router = useRouter();
  const [value, setValue] = useState(p.domain ?? "");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; status?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "تعذر الحفظ");
      toast.success(r.status === "active" ? "النطاق يعمل الآن" : ok);
      router.refresh();
    });
  const st = p.status ? STATUS[p.status] : null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-black text-ink">
          <Globe className="size-5 text-nova-2" aria-hidden="true" /> نطاقك الخاص
        </h1>
        <p className="mt-1 text-[13px] leading-6 text-ink-3">
          اربط نطاقاً اشتريته (مثل mystore.com) ليفتح متجرك عليه. رابطك الحالي <span dir="ltr">{p.subdomainUrl.replace(/^https?:\/\//, "")}</span> يبقى يعمل ويحوّل للنطاق الجديد بعد ربطه.
        </p>
      </header>

      {!p.allowed ? <p className="dash-card p-4 text-[13.5px] text-ink-2">يُربط النطاق بعد تسليم متجرك.</p> : null}

      {p.allowed ? (
        <section className="dash-card space-y-3 p-4 sm:p-5">
          <h2 className="text-[14px] font-black text-ink">1. النطاق</h2>
          <div className="flex flex-wrap gap-2">
            <input dir="ltr" value={value} onChange={(e) => setValue(e.target.value)} disabled={!p.canEdit || pending} placeholder="mystore.com" className="h-11 min-w-[220px] flex-1 rounded-xl border border-edge/10 bg-edge/[0.03] px-3 text-[16px] text-ink outline-none focus:border-nova" />
            {p.canEdit ? (
              <button type="button" disabled={pending || !value.trim() || value.trim().toLowerCase() === p.domain} onClick={() => run(() => setCustomDomainAction(value), "حُفظ النطاق. أضف السجلات أدناه")} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-nova px-4 text-[13.5px] font-black text-white disabled:opacity-50">
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                {p.domain ? "تغيير النطاق" : "ربط النطاق"}
              </button>
            ) : null}
          </div>
          {!p.canEdit ? <p className="text-[12.5px] text-ink-3">ربط النطاق لصاحب المتجر.</p> : null}
        </section>
      ) : null}

      {p.domain ? (
        <>
          <section className="dash-card space-y-3 p-4 sm:p-5">
            <h2 className="text-[14px] font-black text-ink">2. أضف هذه السجلات عند الشركة التي اشتريت منها النطاق</h2>
            <p className="text-[12.5px] leading-6 text-ink-3">ادخل لوحة الشركة (GoDaddy أو Namecheap أو غيرها) ← إدارة DNS ← أضف كل سجل كما هو، واحذف أي سجل A أو CNAME قديم بنفس الاسم.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-[13px]" dir="ltr">
                <thead className="text-ink-3">
                  <tr>
                    <th className="p-2 text-start">Type</th>
                    <th className="p-2 text-start">Name</th>
                    <th className="p-2 text-start">Value</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {p.records.map((r) => (
                    <tr key={`${r.type}${r.name}`} className="border-t border-edge/10 font-mono text-ink">
                      <td className="p-2">{r.type}</td>
                      <td className="p-2">{r.name}</td>
                      <td className="p-2">{r.value}</td>
                      <td className="p-2">
                        <button type="button" aria-label={`انسخ ${r.value}`} onClick={() => navigator.clipboard.writeText(r.value).then(() => toast.success("نُسخ"))} className="grid size-9 place-items-center rounded-lg text-ink-3 hover:text-ink">
                          <Copy className="size-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {p.apexNeedsCname && p.records.some((r) => r.name === "@") ? (
              <p className="text-[12.5px] leading-6 text-ink-3">
                سجل <span dir="ltr" className="font-mono">@</span> من نوع CNAME تسميه بعض الشركات ALIAS أو ANAME. إن لم تسمح شركتك به، انقل إدارة DNS لنطاقك إلى Cloudflare (مجاناً) أو اربط نطاقاً فرعياً مثل <span dir="ltr" className="font-mono">shop.{p.domain}</span>، وكلّمنا إن احتجت مساعدة.
              </p>
            ) : null}
          </section>

          <section className="dash-card space-y-3 p-4 sm:p-5">
            <h2 className="text-[14px] font-black text-ink">3. الحالة</h2>
            {st ? (
              <p className={cn("flex items-center gap-2 text-[14px] font-black", st.tone)}>
                <st.Icon className="size-4" aria-hidden="true" /> {st.label}
              </p>
            ) : null}
            {p.explain ? <p className="text-[13.5px] leading-7 text-ink-2">{p.explain}</p> : null}
            {p.status === "active" ? (
              <a href={`https://${p.domain}`} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-xl bg-ok/15 px-4 text-[13.5px] font-black text-ok" dir="ltr">
                https://{p.domain}
              </a>
            ) : null}
            {p.canEdit ? (
              <div className="flex flex-wrap gap-2">
                {p.status !== "active" ? (
                  <button type="button" disabled={pending} onClick={() => run(checkCustomDomainAction, "فُحص النطاق")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-edge/15 px-4 text-[13px] font-black text-ink">
                    <RefreshCw className="size-4" aria-hidden="true" /> افحص الآن
                  </button>
                ) : null}
                <button type="button" disabled={pending} onClick={() => window.confirm("إلغاء ربط النطاق؟ يعود متجرك لرابطه الحالي فقط.") && run(removeCustomDomainAction, "أُلغي ربط النطاق")} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-[13px] font-black text-bad hover:bg-bad/10">
                  <Trash2 className="size-4" aria-hidden="true" /> إلغاء الربط
                </button>
              </div>
            ) : null}
            {p.checkedAt ? <p className="text-[11.5px] text-ink-3">آخر فحص: {new Date(p.checkedAt).toLocaleString("ar-EG-u-nu-latn", { timeZone: "Africa/Cairo" })}. نفحصه تلقائياً كل فترة أيضاً.</p> : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
