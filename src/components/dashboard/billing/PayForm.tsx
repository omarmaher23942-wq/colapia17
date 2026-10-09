"use client";

// PayForm — دفع Colapia بتحويل يدوي في ثلاث خطوات: حوّل المبلغ (الرقم والمبلغ بزر نسخ)، ثم الرقم الذي حوّلت منه،
// ثم صورة الإيصال (تُضغط في المتصفح وتُرفع لمسار platformReceipt الخاص بصاحب المتجر). بعد الإرسال تتحول الصفحة
// نفسها لحالة «قيد المراجعة» من الخادم (router.refresh)، فلا حالة نجاح محلية قد تخالف الواقع.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { Check, Copy, ImagePlus, Loader2, RefreshCw, Send, Smartphone, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { normalizeEgyptianPhone, prettyPhone } from "@/lib/phone";
import { useUploadThing } from "@/lib/uploadthing-client";
import { submitPlatformPaymentAction } from "@/server/actions/platform";
import { requestPulse } from "../DashboardPulse";
import { inputCls } from "../product/parts";

type Method = "vodafone_cash" | "instapay";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function PayForm({ price, vodafone, instapay }: { price: number; vodafone: string; instapay: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("vodafone_cash");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [receipt, setReceipt] = useState<{ url: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const target = method === "vodafone_cash" ? vodafone : instapay;

  const { startUpload } = useUploadThing("platformReceipt", {
    onUploadError: (e) => setReceiptError(/[؀-ۿ]/.test(e?.message ?? "") ? e.message : "تعذر رفع الصورة. تأكد من الاتصال وحاول مرة أخرى"),
  });

  async function pick(files: FileList | File[] | null) {
    const f = files ? Array.from(files)[0] : undefined;
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type) && !f.type.startsWith("image/")) return setReceiptError("ارفع صورة (لقطة شاشة للإيصال)، لا ملفاً آخر");
    setReceiptError("");
    setUploading(true);
    const preview = URL.createObjectURL(f);
    let file = f;
    try {
      // مقروءة بعد الضغط: الإيصال نص صغير، فلا نصغّره كثيراً.
      const c = await imageCompression(f, { maxSizeMB: 1.5, maxWidthOrHeight: 2400, useWebWorker: true, initialQuality: 0.9 });
      file = new File([c], f.name.replace(/\.\w+$/, "") + ".jpg", { type: c.type || "image/jpeg" });
    } catch {
      /* يُرفع الأصل */
    }
    const res = await startUpload([file]).catch(() => undefined);
    setUploading(false);
    const url = res?.[0]?.ufsUrl;
    if (!url) {
      URL.revokeObjectURL(preview);
      return setReceiptError((e) => e || "تعذر رفع الصورة. حاول مرة أخرى");
    }
    if (receipt) URL.revokeObjectURL(receipt.preview);
    setReceipt({ url, preview });
  }

  function checkPhone(): string | null {
    const n = normalizeEgyptianPhone(phone);
    if (!n) {
      setPhoneError(phone.trim() ? "رقم غير صحيح: 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015" : "اكتب رقم المحفظة أو الحساب الذي حوّلت منه");
      return null;
    }
    setPhoneError("");
    setPhone(n);
    return n;
  }

  async function submit() {
    const n = checkPhone();
    if (!receipt) setReceiptError("ارفع صورة الإيصال");
    if (!n) return void document.getElementById("pay-phone")?.focus();
    if (!receipt) return void fileRef.current?.closest("section")?.scrollIntoView({ block: "center", behavior: "smooth" });
    setSending(true);
    const r = await submitPlatformPaymentAction({ method, senderPhone: n, screenshotUrl: receipt.url }).catch(() => ({ ok: false as const, error: "انقطع الاتصال، حاول مرة أخرى" }));
    setSending(false);
    if (!r.ok) {
      toast.error(r.error);
      // إيصال سابق قيد المراجعة أو تغيّرت حالة المتجر: الصفحة تعرض الواقع.
      router.refresh();
      return;
    }
    toast.success("وصل إيصالك، وسنراجعه بأنفسنا");
    requestPulse();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* 1) التحويل */}
      <Step n={1} title="حوّل المبلغ">
        <div role="radiogroup" aria-label="وسيلة التحويل" className="grid grid-cols-2 gap-2">
          {(
            [
              { key: "vodafone_cash", label: "فودافون كاش", hint: "من أي محفظة موبايل", icon: Smartphone },
              { key: "instapay", label: "إنستاباي", hint: "من تطبيق InstaPay", icon: Wallet },
            ] as const
          ).map((m) => {
            const on = method === m.key;
            return (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMethod(m.key)}
                className={cn(
                  "flex min-h-16 items-center gap-3 rounded-xl border p-3 text-start transition-colors",
                  on ? "border-nova/50 bg-nova/10" : "border-edge/10 hover:border-edge/20 hover:bg-edge/[0.03]"
                )}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", on ? "bg-nova text-white" : "bg-edge/[0.06] text-ink-3")}>
                  <m.icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-black text-ink">{m.label}</span>
                  <span className="block text-[11px] text-ink-3">{m.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <dl className="mt-3 divide-y divide-edge/10 rounded-xl border border-edge/10 bg-edge/[0.02]">
          <CopyRow label={method === "vodafone_cash" ? "حوّل إلى رقم المحفظة" : "حوّل إلى الرقم المربوط بإنستاباي"} display={prettyPhone(target)} value={target} />
          <CopyRow label="المبلغ بالضبط" display={`${fmtNum(price)} ج.م`} value={String(price)} />
        </dl>
        <p className="mt-2 text-[11.5px] leading-5 text-ink-3">حوّل المبلغ كاملاً في تحويل واحد، ثم التقط صورة لشاشة نجاح التحويل.</p>
      </Step>

      {/* 2) الرقم المحوَّل منه */}
      <Step n={2} title="الرقم الذي حوّلت منه">
        <label htmlFor="pay-phone" className="sr-only">
          الرقم الذي حوّلت منه
        </label>
        <input
          id="pay-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          placeholder="01xxxxxxxxx"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            if (phoneError) setPhoneError("");
          }}
          onBlur={() => phone.trim() && checkPhone()}
          aria-invalid={Boolean(phoneError)}
          aria-describedby="pay-phone-hint"
          className={cn(inputCls, "text-end font-mono tabular-nums", phoneError && "border-bad/60")}
        />
        <p id="pay-phone-hint" className={cn("mt-1.5 text-[11.5px]", phoneError ? "font-bold text-bad" : "text-ink-3")}>
          {phoneError || "نطابقه مع الإيصال لنتأكد أن التحويل منك."}
        </p>
      </Step>

      {/* 3) الإيصال */}
      <Step n={3} title="صورة الإيصال">
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void pick(e.target.files).finally(() => (e.target.value = ""))} />
        {receipt ? (
          <div className="flex items-center gap-3 rounded-xl border border-edge/10 bg-edge/[0.02] p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receipt.preview} alt="صورة الإيصال المرفوعة" className="h-24 w-20 shrink-0 rounded-lg bg-edge/5 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-ok">
                <Check className="size-4" aria-hidden="true" /> رُفعت الصورة
              </p>
              <p className="mt-0.5 text-[11.5px] text-ink-3">تأكد أن المبلغ والتاريخ ظاهران فيها.</p>
              <div className="mt-2 flex gap-1.5">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-edge/10 px-2.5 text-[12px] font-bold text-ink-2 hover:bg-edge/5">
                  {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-3.5" aria-hidden="true" />} غيّرها
                </button>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(receipt.preview);
                    setReceipt(null);
                  }}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-bold text-ink-3 hover:bg-bad/10 hover:text-bad"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" /> احذفها
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void pick(e.dataTransfer.files);
            }}
            disabled={uploading}
            aria-describedby="pay-receipt-hint"
            className={cn(
              "flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-colors",
              receiptError ? "border-bad/50 bg-bad/[0.04]" : "border-edge/15 hover:border-nova/40 hover:bg-nova/[0.04]"
            )}
          >
            {uploading ? <Loader2 className="size-6 animate-spin text-nova-2" aria-hidden="true" /> : <ImagePlus className="size-6 text-ink-3" aria-hidden="true" />}
            <span className="text-[13px] font-black text-ink">{uploading ? "نرفع الصورة…" : "اختر صورة الإيصال"}</span>
            <span className="text-[11.5px] text-ink-3">لقطة شاشة من المحفظة أو التطبيق، حتى 8 ميجابايت</span>
          </button>
        )}
        <p id="pay-receipt-hint" role={receiptError ? "alert" : undefined} className={cn("mt-1.5 text-[11.5px] font-bold text-bad", !receiptError && "sr-only")}>
          {receiptError}
        </p>
      </Step>

      <button
        type="button"
        onClick={() => void submit()}
        disabled={sending || uploading}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-nova to-nova-deep px-5 text-[14px] font-black text-white shadow-lg shadow-nova/20 transition hover:shadow-xl disabled:opacity-60"
      >
        {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
        {sending ? "نرسل الإيصال…" : "أرسل الإيصال للمراجعة"}
      </button>
      <p className="text-center text-[11.5px] leading-5 text-ink-3">نراجع كل إيصال بأنفسنا. عند القبول يُفعَّل متجرك ويصلك بريد، ولا يُجمَّد متجرك ولا يُحذف أثناء المراجعة.</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`pay-step-${n}`} className="dash-card p-4 sm:p-5">
      <h3 id={`pay-step-${n}`} className="mb-3 flex items-center gap-2 text-[14px] font-black text-ink">
        <span className="grid size-6 place-items-center rounded-full bg-nova/15 text-[12px] font-black text-nova-2 tabular-nums">{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function CopyRow({ label, display, value }: { label: string; display: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <dt className="text-[11.5px] text-ink-3">{label}</dt>
        <dd dir="ltr" className="text-end text-[17px] font-black tabular-nums text-ink">
          {display}
        </dd>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(
            () => {
              setDone(true);
              setTimeout(() => setDone(false), 1800);
            },
            () => toast.error("تعذر النسخ، انسخه يدوياً")
          );
        }}
        aria-label={`انسخ ${label}`}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-edge/10 px-3 text-[12px] font-bold text-ink-2 hover:bg-edge/5"
      >
        {done ? <Check className="size-4 text-ok" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        {done ? "نُسخ" : "انسخ"}
      </button>
    </div>
  );
}
