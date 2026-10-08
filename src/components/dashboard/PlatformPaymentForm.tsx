"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check, UploadCloud, Smartphone, Wallet, Mic, Star } from "lucide-react";
import { UploadButton } from "@/lib/uploadthing-client";
import { submitPlatformPaymentAction } from "@/server/actions/platform";

export function PlatformPaymentForm({
  subdomain,
  amount,
  vodafoneCashNumber,
  instapayNumber,
}: {
  subdomain: string;
  amount: number;
  vodafoneCashNumber: string;
  instapayNumber: string;
}) {
  const [method, setMethod] = useState<"vodafone_cash" | "instapay">("vodafone_cash");
  const [phone, setPhone] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [done, setDone] = useState<null | { activated: boolean; message?: string }>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copiedVf, setCopiedVf] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);

  const copyToClipboard = (text: string, type: "vf" | "ip") => {
    navigator.clipboard.writeText(text);
    if (type === "vf") {
      setCopiedVf(true);
      setTimeout(() => setCopiedVf(false), 2000);
    } else {
      setCopiedIp(true);
      setTimeout(() => setCopiedIp(false), 2000);
    }
    toast.success("تم نسخ الرقم بنجاح");
  };

  const handleSubmit = async () => {
    if (!phone.trim()) {
      toast.error("اكتب الرقم الذي قمت بالتحويل منه أولاً");
      return;
    }
    if (!screenshotUrl) {
      toast.error("ارفع صورة إيصال التحويل أولاً");
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitPlatformPaymentAction(subdomain, {
        method,
        senderPhone: phone.trim(),
        screenshotUrl,
      });

      if (res.ok) {
        setDone({ activated: false, message: "message" in res ? res.message : undefined });
        toast.success("استلمنا إيصالك، ونراجعه الآن");
      } else {
        toast.error(res.error || "حدث خطأ أثناء الإرسال، حاول مجدداً");
      }
    } catch {
      toast.error("تعذر الاتصال بالخادم، تأكد من اتصال الإنترنت");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center space-y-3">
        <div className="size-12 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto">
          <Check className="size-6" />
        </div>
        <h3 className="text-base font-black text-emerald-900">استلمنا إيصال التحويل</h3>
        <p className="text-xs text-emerald-700 leading-relaxed max-w-md mx-auto">
          {done.message ??
            "نراجع إيصالك الآن يدوياً، وفور قبوله يُفعَّل متجرك ويصلك بريد بذلك. يمكنك متابعة الحالة من هذه الصفحة."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. اختيار طريقة التحويل */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMethod("vodafone_cash")}
          className={`p-4 rounded-2xl border-2 text-start transition-all ${
            method === "vodafone_cash"
              ? "border-red-600 bg-red-50/50 shadow-xs"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Smartphone className={`size-4 ${method === "vodafone_cash" ? "text-red-600" : "text-slate-500"}`} />
            <span className="font-bold text-xs text-slate-900">فودافون كاش</span>
          </div>
          <span className="text-[11px] text-slate-500 block">محافظ إلكترونية</span>
        </button>

        <button
          type="button"
          onClick={() => setMethod("instapay")}
          className={`p-4 rounded-2xl border-2 text-start transition-all ${
            method === "instapay"
              ? "border-purple-600 bg-purple-50/50 shadow-xs"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Wallet className={`size-4 ${method === "instapay" ? "text-purple-600" : "text-slate-500"}`} />
            <span className="font-bold text-xs text-slate-900">إنستاباي (InstaPay)</span>
          </div>
          <span className="text-[11px] text-slate-500 block">تحويل بنكي ولحظي</span>
        </button>
      </div>

      {/* 2. بطاقة الرقم المطلوب التحويل له مع زر النسخ */}
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
        <span className="text-xs font-bold text-slate-500 block">
          {method === "vodafone_cash" ? "رقم محفظة فودافون كاش:" : "رقم أو حساب إنستاباي:"}
        </span>

        <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
          <span className="font-mono text-sm sm:text-base font-black text-slate-900 select-all" dir="ltr">
            {method === "vodafone_cash" ? vodafoneCashNumber : instapayNumber}
          </span>
          <button
            type="button"
            onClick={() =>
              copyToClipboard(
                method === "vodafone_cash" ? vodafoneCashNumber : instapayNumber,
                method === "vodafone_cash" ? "vf" : "ip"
              )
            }
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
          >
            {(method === "vodafone_cash" ? copiedVf : copiedIp) ? (
              <>
                <Check className="size-3.5 text-emerald-400" />
                <span>تم النسخ</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>نسخ الرقم</span>
              </>
            )}
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          المبلغ المطلوب تحويله بعرض الخصم هو: <b className="text-slate-900">{amount} جنيه مصري</b> فقط.
        </p>
      </div>

      {/* 3. إدخال الرقم الذي تم التحويل منه */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          الرقم الذي حوّلت منه (رقم محفظتك أو حسابك) *:
        </label>
        <input
          type="tel"
          dir="ltr"
          placeholder="01xxxxxxxxx"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-slate-900 transition-colors"
          required
        />
      </div>

      {/* 4. رفع صورة الإيصال */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          صورة إيصال التحويل (سكرين شوت) *:
        </label>

        {screenshotUrl ? (
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 max-h-60 w-fit">
            <img src={screenshotUrl} alt="إيصال التحويل" className="max-h-60 object-contain mx-auto" />
            <button
              type="button"
              onClick={() => setScreenshotUrl("")}
              className="absolute top-2 end-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm"
            >
              تغيير الصورة
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-slate-400 transition-colors bg-white">
            <UploadButton
              endpoint="transferProof"
              input={{ subdomain }}
              onClientUploadComplete={(res) => {
                const url = res?.[0]?.ufsUrl ?? res?.[0]?.url;
                if (url) {
                  setScreenshotUrl(url);
                  toast.success("تم رفع صورة الإيصال بنجاح");
                }
              }}
              onUploadError={(e) => {
                toast.error(e?.message || "فشل رفع الصورة، تأكد من الاتصال وحاول ثانية");
              }}
              content={{
                button: "اضغط لاختيار صورة الإيصال",
                allowedContent: "الصور بصيغة PNG أو JPG حتى 8 ميجابايت",
              }}
              appearance={{
                button: "bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs",
                allowedContent: "text-[11px] text-slate-400 mt-2",
              }}
            />
          </div>
        )}
      </div>

      {/* 5. زر التأكيد النهائي */}
      <button
        type="button"
        disabled={!screenshotUrl || !phone.trim() || submitting}
        onClick={handleSubmit}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3.5 rounded-xl text-sm transition-all shadow-sm hover:brightness-105 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {submitting ? "جاري إرسال التحويل..." : `تأكيد إرسال التحويل (${amount} ج.م) وتفعيل المتجر للأبد`}
      </button>
    </div>
  );
}