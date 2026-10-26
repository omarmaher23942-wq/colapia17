"use client";

// PayForm — «تفعيل الموقع»: تحويل بفودافون كاش أو إنستاباي ثم رفع الإيصال. المبلغ يُعرض من الخادم ويُعاد حسابه عند الإرسال.
import { useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { Check, Copy, ImagePlus, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { prettyPhone } from "@/lib/phone";
import { useMediaUpload } from "@/lib/media-upload";
import { submitActivationPaymentAction } from "@/server/actions/activation";
import { inputCls } from "../product/parts";

type Method = "vodafone_cash" | "instapay";

export function PayForm({ offer, price, vodafone, instapay }: { offer: "golden" | "standard"; price: number; vodafone: string; instapay: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<Method>("vodafone_cash");
  const [phone, setPhone] = useState("");
  const [receipt, setReceipt] = useState<{ url: string; preview: string } | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const { startUpload } = useMediaUpload("platformReceipt", { onUploadError: (e) => setError(e.message) });
  const number = method === "vodafone_cash" ? vodafone : instapay;

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("المطلوب صورة (لقطة شاشة للإيصال).");
    setError("");
    setUploading(true);
    let file = f;
    try {
      const c = await imageCompression(f, { maxSizeMB: 1.5, maxWidthOrHeight: 2400, useWebWorker: false, initialQuality: 0.9 });
      file = new File([c], f.name.replace(/\.\w+$/, "") + ".jpg", { type: c.type || "image/jpeg" });
    } catch {
      /* يُرفع الأصل */
    }
    const res = await startUpload([file]).catch(() => undefined);
    setUploading(false);
    const url = res?.[0]?.ufsUrl;
    if (!url) return setError((e) => e || "تعذر رفع الصورة. حاولوا مرة أخرى.");
    if (receipt) URL.revokeObjectURL(receipt.preview);
    setReceipt({ url, preview: URL.createObjectURL(file) });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!receipt) return setError("ارفعوا صورة إيصال التحويل أولاً.");
    setError("");
    setSending(true);
    const r = await submitActivationPaymentAction({ method, senderPhone: phone, screenshotUrl: receipt.url, expectedOffer: offer });
    setSending(false);
    if (!r.ok) return setError(r.error);
    toast.success("وصلنا الإيصال، نراجعه ونبلغكم فور تأكيده");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <fieldset>
        <legend className="text-[13px] font-bold">وسيلة التحويل</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {(["vodafone_cash", "instapay"] as const).map((m) => (
            <label key={m} className={cn("flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border p-3 text-[14px] font-bold", method === m ? "border-nova bg-nova/10" : "border-edge/15")}>
              <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} className="accent-[var(--dash-nova)]" /> {m === "vodafone_cash" ? "فودافون كاش" : "إنستاباي"}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-nova/10 p-3.5">
        <div>
          <p className="text-[12.5px] text-ink-3">حوّلوا {fmtNum(price)} جنيه إلى</p>
          <p dir="ltr" className="text-start text-xl font-black">{/^\d{11}$/.test(number) ? prettyPhone(number) : number}</p>
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(number);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* ظاهر ويُنسخ يدوياً */
            }
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-edge/15 px-3 text-[13px] font-bold"
        >
          {copied ? <Check className="size-4 text-ok" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />} {copied ? "تم النسخ" : "نسخ الرقم"}
        </button>
      </div>
      <label className="block text-[13px] font-bold">
        الرقم الذي حوّلتم منه
        <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" inputMode="tel" placeholder="01XXXXXXXXX" className={cn(inputCls, "mt-1.5 text-start")} />
      </label>
      <div>
        <p className="text-[13px] font-bold">صورة الإيصال</p>
        {receipt ? (
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-edge/15 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receipt.preview} alt="معاينة الإيصال" className="size-20 rounded-xl object-cover" />
            <p className="flex-1 text-[13px] font-bold text-ok">رُفع الإيصال</p>
            <button type="button" onClick={() => { URL.revokeObjectURL(receipt.preview); setReceipt(null); }} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-edge/15 px-3 text-[13px] font-bold">
              <Trash2 className="size-4" aria-hidden="true" /> إزالة
            </button>
          </div>
        ) : (
          <label className={cn("mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-edge/20 p-4 text-center text-[14px] font-bold", uploading && "opacity-60")}>
            {uploading ? <Loader2 className="size-6 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-6" aria-hidden="true" />}
            {uploading ? "جارٍ الرفع…" : "اضغطوا لاختيار صورة الإيصال"}
            <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => { void pick(e.target.files); e.currentTarget.value = ""; }} />
          </label>
        )}
      </div>
      {error ? <p role="alert" className="text-[13.5px] font-bold text-bad">{error}</p> : null}
      <button type="submit" disabled={sending || uploading} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-nova px-6 text-[15px] font-black text-white disabled:opacity-60">
        {sending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />} إرسال الإيصال
      </button>
    </form>
  );
}
