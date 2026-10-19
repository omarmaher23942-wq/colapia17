"use client";

// SubdomainSection — «رابط المتجر» في الإعدادات (V3 D1): يعرض الرابط الحالي، ويغيّره صاحب المتجر وحده بعد فحص حي للتوفر
// وتأكيد صريح. الرابط القديم يحوّل للجديد مدة محددة (تظهر هنا بموعد انتهائها). الخادم يعيد كل التحقق (actions/subdomain.ts).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, ExternalLink, Link2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { normalizeSubdomainInput, validateSubdomain } from "@/lib/subdomain-change";
import { changeSubdomainAction, checkSubdomainAction, subdomainInfoAction, type SubdomainInfo } from "@/server/actions/subdomain";
import { ConfirmDialog } from "../ui/DashDialog";

type Check = { state: "idle" } | { state: "checking" } | { state: "ok"; value: string } | { state: "bad"; error: string };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long" });

export function SubdomainSection() {
  const router = useRouter();
  const [info, setInfo] = useState<SubdomainInfo | null | undefined>(undefined);
  const [value, setValue] = useState("");
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [confirm, setConfirm] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    let alive = true;
    subdomainInfoAction()
      .then((r) => alive && setInfo(r))
      .catch(() => alive && setInfo(null));
    return () => {
      alive = false;
    };
  }, []);

  // فحص التوفر بعد توقف الكتابة؛ الصيغة تُفحص فوراً في المتصفح بنفس قواعد الخادم.
  useEffect(() => {
    if (!info || !value.trim()) {
      setCheck({ state: "idle" });
      return;
    }
    const local = validateSubdomain(value, info.subdomain, info.root);
    if (!local.ok) {
      setCheck({ state: "bad", error: local.error });
      return;
    }
    const id = ++seq.current;
    setCheck({ state: "checking" });
    const t = setTimeout(() => {
      checkSubdomainAction(local.value)
        .then((r) => {
          if (id !== seq.current) return;
          setCheck(r.ok ? { state: "ok", value: r.value } : { state: "bad", error: r.error });
        })
        .catch(() => id === seq.current && setCheck({ state: "bad", error: "تعذر الفحص الآن، حاولوا بعد قليل." }));
    }, 450);
    return () => clearTimeout(t);
  }, [value, info]);

  if (info === undefined) {
    return (
      <section aria-busy="true" className="dash-card h-40 animate-pulse p-4 sm:p-5">
        <span className="sr-only">جارٍ تحميل رابط المتجر</span>
      </section>
    );
  }
  if (!info) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.url);
      toast.success("نُسخ الرابط");
    } catch {
      toast.error("تعذر النسخ، انسخوه يدوياً");
    }
  };

  const ready = check.state === "ok";
  const preview = normalizeSubdomainInput(value, info.root);

  return (
    <section aria-labelledby="sub-title" className="dash-card space-y-4 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-nova/15 text-nova-2" aria-hidden="true">
          <Link2 className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <h2 id="sub-title" className="text-[15px] font-black text-ink">رابط المتجر</h2>
          <p className="mt-0.5 text-[12px] leading-6 text-ink-3">الرابط الذي يفتح منه العملاء متجركم. يمكن تغييره، ويبقى الرابط القديم يحوّل للجديد مدة {info.redirectDays} يوماً.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-edge/10 bg-edge/[0.03] p-3">
        <bdi dir="ltr" className="min-w-0 flex-1 truncate font-mono text-[13px] font-bold text-ink">
          {info.url.replace(/^https?:\/\//, "")}
        </bdi>
        <button type="button" onClick={copy} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50">
          <Copy className="size-4" aria-hidden="true" /> نسخ
        </button>
        <a href={info.url} target="_blank" rel="noopener" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50">
          <ExternalLink className="size-4" aria-hidden="true" /> فتح
        </a>
      </div>
      {info.customDomain ? (
        <p className="text-[12px] leading-6 text-ink-3">
          نطاقكم الخاص <bdi dir="ltr" className="font-mono font-bold text-ink-2">{info.customDomain}</bdi> مفعّل ويبقى كما هو بعد أي تغيير هنا.
        </p>
      ) : null}

      {info.canChange ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) setConfirm(true);
          }}
        >
          <label htmlFor="new-sub" className="block text-[12.5px] font-bold text-ink-2">
            الرابط الجديد
          </label>
          <div dir="ltr" className={cn("flex min-h-12 items-center overflow-hidden rounded-xl border bg-edge/[0.02] focus-within:ring-2 focus-within:ring-nova/40", check.state === "bad" ? "border-bad/50" : ready ? "border-ok/50" : "border-edge/15")}>
            <input
              id="new-sub"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={60}
              placeholder="my-brand"
              aria-describedby="new-sub-hint"
              aria-invalid={check.state === "bad"}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-[14px] text-ink outline-none placeholder:text-ink-3/60"
            />
            <span className="shrink-0 truncate pe-3 font-mono text-[12.5px] text-ink-3">.{info.root.split(":")[0]}</span>
          </div>
          <p id="new-sub-hint" role="status" aria-live="polite" className="flex min-h-6 items-center gap-1.5 text-[12px]">
            {check.state === "checking" ? (
              <>
                <Loader2 className="size-3.5 animate-spin text-ink-3" aria-hidden="true" /> <span className="text-ink-3">نتحقق من التوفر…</span>
              </>
            ) : check.state === "ok" ? (
              <>
                <CheckCircle2 className="size-3.5 text-ok" aria-hidden="true" /> <span className="font-bold text-ok">متاح</span>
              </>
            ) : check.state === "bad" ? (
              <>
                <XCircle className="size-3.5 text-bad" aria-hidden="true" /> <span className="text-bad">{check.error}</span>
              </>
            ) : (
              <span className="text-ink-3">حروف إنجليزية صغيرة وأرقام وشرطة، من 3 إلى 30 حرفاً.</span>
            )}
          </p>
          <button type="submit" disabled={!ready} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[12.5px] font-black text-white shadow-md transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50 focus-visible:ring-offset-2">
            تغيير الرابط
          </button>
        </form>
      ) : (
        <p className="rounded-xl border border-edge/10 bg-edge/[0.03] p-3 text-[12.5px] leading-6 text-ink-2">{info.reason}</p>
      )}

      {info.previous.length ? (
        <div className="space-y-1.5">
          <h3 className="text-[12.5px] font-bold text-ink-2">روابط سابقة تحوّل للرابط الحالي</h3>
          <ul className="space-y-1">
            {info.previous.map((p) => (
              <li key={p.sub} className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-3">
                <bdi dir="ltr" className="font-mono">{`${p.sub}.${info.root.split(":")[0]}`}</bdi>
                <span>حتى {fmtDate(p.until)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="تغيير رابط المتجر؟"
        description={`سيصبح الرابط ${preview}.${info.root.split(":")[0]}، ويحوّل الرابط الحالي إليه مدة ${info.redirectDays} يوماً. حدّثوا الرابط في البايو والإعلانات والمطبوعات خلال هذه المدة.`}
        confirmLabel="تغيير الرابط"
        onConfirm={async () => {
          if (check.state !== "ok") return false;
          const r = await changeSubdomainAction(check.value);
          if (!r.ok) {
            toast.error(r.error);
            setCheck({ state: "bad", error: r.error });
            return false;
          }
          toast.success("تغيّر رابط المتجر");
          setValue("");
          setCheck({ state: "idle" });
          setConfirm(false);
          const fresh = await subdomainInfoAction().catch(() => null);
          if (fresh) setInfo(fresh);
          router.refresh();
          return true;
        }}
      />
    </section>
  );
}
