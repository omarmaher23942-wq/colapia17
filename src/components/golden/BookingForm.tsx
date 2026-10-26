"use client";

// BookingForm — صفحة حجز المشروع (V4). ثلاث بطاقات: العرض (والعدّاد الحي للدائرة الذهبية متى كان فيها مقعد)، بيانات المتجر
// (البريد إلزامي: منه يدخل العميل حسابه لاحقاً)، ثم التحويل والإيصال. السعر يأتي من الخادم ويُعاد حسابه عند الإرسال؛ حين
// تنتهي مقاعد العرض يظهر السعر العادي بالتدفق نفسه بلا ذكر للعرض ولا عدّاد. المسودة على الجهاز فقط (localStorage) إلى أن
// يُرسل الحجز.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { Check, Copy, Crown, ImagePlus, Loader2, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import { prettyPhone } from "@/lib/phone";
import { uploadDirect } from "@/lib/media-upload";
import { LIMITS, METHOD_LABEL, type BookingFields, type BookingMethod } from "@/golden/schema";
import type { ProjectQuote } from "@/lib/platform-pricing";

const KEY = "clp-golden-v1";
const field = "mt-1.5 block h-12 w-full rounded-xl border border-[var(--g-line)] bg-[var(--g-input)] px-3.5 text-[15px] text-[var(--g-fg)] outline-none placeholder:text-[var(--g-muted)]/70 focus-visible:border-[var(--g-accent)] focus-visible:ring-2 focus-visible:ring-[var(--g-accent)]/40 aria-[invalid=true]:border-[var(--g-bad)]";
const card = "rounded-3xl border border-[var(--g-line)] bg-[var(--g-card)] p-5 sm:p-6";

type Errors = Partial<Record<keyof BookingFields | "method" | "senderPhone" | "receipt" | "form", string>>;

const read = (): Partial<BookingFields> => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
};

function CopyNumber({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          /* النسخ غير متاح: الرقم ظاهر ويُنسخ يدوياً */
        }
      }}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--g-line)] px-3 text-[13px] font-bold"
    >
      {done ? <Check className="size-4 text-[var(--g-ok)]" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      {done ? "تم النسخ" : "نسخ الرقم"}
    </button>
  );
}

export function BookingForm({
  initial,
  token: initialToken,
  ticket,
  quote,
  pay,
}: {
  initial: BookingFields;
  token: string | null;
  ticket: string;
  quote: ProjectQuote;
  pay: { vodafone: string; instapay: string };
}) {
  const router = useRouter();
  const golden = quote.offer === "golden";
  const [f, setF] = useState<BookingFields>(initial);
  const [method, setMethod] = useState<BookingMethod>("vodafone_cash");
  const [sender, setSender] = useState("");
  const [token, setToken] = useState<string | null>(initialToken);
  const [receipt, setReceipt] = useState<{ key: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [honey, setHoney] = useState("");
  const form = useRef<HTMLFormElement>(null);

  // استعادة المسودة المحلية: لا تكتب فوق ما جاء من الوكيل.
  useEffect(() => {
    const saved = read();
    setF((cur) => ({
      storeName: cur.storeName || saved.storeName || "",
      niche: cur.niche || saved.niche || "",
      instagram: cur.instagram || saved.instagram || "",
      whatsapp: cur.whatsapp || saved.whatsapp || "",
      email: cur.email || saved.email || "",
      styleNotes: cur.styleNotes || saved.styleNotes || "",
      consent: cur.consent || saved.consent === true,
    }));
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(f));
    } catch {
      /* التخزين المحلي غير متاح */
    }
  }, [f]);

  const set = <K extends keyof BookingFields>(k: K, v: BookingFields[K]) => {
    setF((cur) => ({ ...cur, [k]: v }));
    setErrors((e) => (e[k] || e.form ? { ...e, [k]: undefined, form: undefined } : e));
  };

  async function ensureToken(): Promise<string | null> {
    if (token) return token;
    const r = await fetch("/api/golden/draft", { method: "POST", credentials: "same-origin" }).catch(() => null);
    const j = (await r?.json().catch(() => null)) as { token?: string; error?: string } | null;
    if (!r?.ok || !j?.token) {
      setErrors((e) => ({ ...e, receipt: j?.error ?? "تعذر بدء الحجز. حاولوا مرة أخرى." }));
      return null;
    }
    setToken(j.token);
    return j.token;
  }

  async function pickReceipt(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;
    if (!picked.type.startsWith("image/")) return setErrors((e) => ({ ...e, receipt: "المطلوب صورة (لقطة شاشة للإيصال) لا ملف آخر." }));
    setErrors((e) => ({ ...e, receipt: undefined }));
    setUploading(true);
    const t = await ensureToken();
    if (!t) return setUploading(false);
    let file = picked;
    try {
      // الإيصال نص صغير: نضغطه بحذر كي يبقى مقروءاً.
      const c = await imageCompression(picked, { maxSizeMB: 1.5, maxWidthOrHeight: 2400, useWebWorker: false, initialQuality: 0.9 });
      file = new File([c], picked.name.replace(/\.\w+$/, "") + ".jpg", { type: c.type || "image/jpeg" });
    } catch {
      /* يُرفع الأصل */
    }
    try {
      const [up] = await uploadDirect("bookingReceipt", [file], { token: t });
      if (!up) throw new Error("تعذر رفع الصورة. حاولوا مرة أخرى.");
      if (receipt) URL.revokeObjectURL(receipt.preview);
      setReceipt({ key: up.key, preview: URL.createObjectURL(file) });
    } catch (e) {
      setErrors((x) => ({ ...x, receipt: e instanceof Error ? e.message : "تعذر رفع الصورة." }));
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending || uploading) return;
    setErrors({});
    if (!token || !receipt) {
      setErrors({ receipt: "ارفعوا صورة إيصال التحويل قبل الإرسال." });
      return;
    }
    setSending(true);
    const body = { ...f, t: token, st: ticket, method, senderPhone: sender, receiptKey: receipt.key, expectedOffer: quote.offer, website: honey };
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch("/api/golden/submit", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) }).catch(() => null);
      const j = (await r?.json().catch(() => null)) as { ok?: boolean; next?: string; error?: string; field?: keyof Errors; retry?: boolean; reload?: boolean } | null;
      if (j?.ok && j.next) {
        try {
          localStorage.removeItem(KEY);
        } catch {
          /* لا يهم */
        }
        router.push(j.next);
        return;
      }
      if (j?.retry && attempt === 0) {
        await new Promise((res) => setTimeout(res, 3500));
        continue;
      }
      const key = j?.field && j.field in { ...f, method: 1, senderPhone: 1, receipt: 1 } ? j.field : "form";
      setErrors({ [key]: j?.error ?? "تعذر الإرسال. تأكدوا من الاتصال وحاولوا مرة أخرى." });
      setSending(false);
      requestAnimationFrame(() => {
        const el = form.current?.querySelector<HTMLElement>(`[name="${key}"]`) ?? form.current?.querySelector<HTMLElement>("[data-form-error]");
        el?.focus();
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return;
    }
  }

  const numberFor = method === "vodafone_cash" ? pay.vodafone : pay.instapay;
  const price = fmtNum(quote.price);
  const err = (k: keyof Errors) => (errors[k] ? <p id={`e-${k}`} role="alert" className="mt-1.5 text-[13px] font-bold text-[var(--g-bad)]">{errors[k]}</p> : null);
  const inv = (k: keyof Errors) => ({ "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `e-${k}` : undefined } as const);

  return (
    <form ref={form} onSubmit={submit} noValidate className="space-y-5">
      <section className={cn(card, golden && "border-amber-400/40")}>
        {golden ? (
          <>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-[12px] font-black text-[var(--g-warn)]">
              <Crown className="size-3.5" aria-hidden="true" /> الدائرة الذهبية
            </p>
            <h1 className="mt-3 text-2xl font-black leading-tight">احجزوا مقعدكم في الدائرة الذهبية</h1>
            <p className="mt-3 flex items-baseline gap-3">
              <span className="text-4xl font-black">{price}</span>
              <span className="text-[15px] font-bold">جنيه</span>
              <span className="text-[15px] text-[var(--g-muted)] line-through decoration-2" aria-label={`بدلاً من ${fmtNum(quote.regularPrice)} جنيه`}>
                {fmtNum(quote.regularPrice)}
              </span>
            </p>
            <div className="mt-4" role="group" aria-label="المقاعد المتبقية">
              <div className="flex items-center justify-between text-[13px] font-bold">
                <span>باقٍ {fmtNum(quote.seatsLeft)} من {fmtNum(quote.seats)} مقاعد</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--g-line)]" aria-hidden="true">
                <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round(((quote.seats - quote.seatsLeft) / Math.max(1, quote.seats)) * 100)}%` }} />
              </div>
            </div>
            <p className="mt-4 text-[14px] leading-7 text-[var(--g-muted)]">عرض خاص لأول {fmtNum(quote.seats)} متاجر، مقابل تعاون بسيط بعد التسليم (فيديو Collab أو شهادة) بموافقتكم على النسخة النهائية قبل نشرها.</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-black leading-tight">احجزوا مشروع متجركم</h1>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-black">{price}</span>
              <span className="text-[15px] font-bold">جنيه</span>
            </p>
          </>
        )}
        <ul className="mt-4 space-y-2 text-[14px] leading-7">
          {["نصمم ونجهّز متجركم ونسلّمه بكامل كوده ومشروعه ملكاً لكم", "جلسة تسليم مباشرة نجلس فيها معكم حتى يفتح متجركم ويعمل", "نبدأ التجهيز خلال 48 ساعة من تأكيد الدفع"].map((t) => (
            <li key={t} className="flex gap-2.5">
              <Check className="mt-1.5 size-4 shrink-0 text-[var(--g-ok)]" aria-hidden="true" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={card}>
        <h2 className="text-lg font-black">بيانات المتجر</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="storeName" className="text-[13px] font-bold">اسم المتجر</label>
            <input id="storeName" name="storeName" value={f.storeName} onChange={(e) => set("storeName", e.target.value)} maxLength={LIMITS.storeName} autoComplete="organization" className={field} {...inv("storeName")} />
            {err("storeName")}
          </div>
          <div>
            <label htmlFor="niche" className="text-[13px] font-bold">النشاط</label>
            <input id="niche" name="niche" value={f.niche} onChange={(e) => set("niche", e.target.value)} maxLength={LIMITS.niche} placeholder="مثل: ملابس رجالية، أحذية، إكسسوارات" className={field} {...inv("niche")} />
            {err("niche")}
          </div>
          <div>
            <label htmlFor="instagram" className="text-[13px] font-bold">حساب إنستجرام</label>
            <input id="instagram" name="instagram" dir="ltr" value={f.instagram} onChange={(e) => set("instagram", e.target.value)} maxLength={LIMITS.instagram} placeholder="@yourbrand" autoCapitalize="none" autoCorrect="off" className={cn(field, "text-start")} {...inv("instagram")} />
            {err("instagram")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="whatsapp" className="text-[13px] font-bold">رقم واتساب</label>
              <input id="whatsapp" name="whatsapp" type="tel" inputMode="tel" dir="ltr" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="01XXXXXXXXX" autoComplete="tel" className={cn(field, "text-start")} {...inv("whatsapp")} />
              {err("whatsapp")}
            </div>
            <div>
              <label htmlFor="email" className="text-[13px] font-bold">البريد الإلكتروني</label>
              <input id="email" name="email" type="email" inputMode="email" dir="ltr" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" autoCapitalize="none" className={cn(field, "text-start")} {...inv("email")} />
              {err("email")}
            </div>
          </div>
          <p className="-mt-1 text-[12.5px] leading-6 text-[var(--g-muted)]">بريدكم هو حسابكم لمتابعة المشروع وطلب التعديلات لاحقاً، فاكتبوه بدقة.</p>
          <div>
            <label htmlFor="styleNotes" className="text-[13px] font-bold">ما تحبون أن نعرفه عن أسلوب المتجر <span className="font-normal text-[var(--g-muted)]">(اختياري)</span></label>
            <textarea id="styleNotes" name="styleNotes" value={f.styleNotes} onChange={(e) => set("styleNotes", e.target.value)} maxLength={LIMITS.styleNotes} rows={4} placeholder="ألوان تفضلونها، متاجر تعجبكم، أسلوب الصور…" className={cn(field, "h-auto py-3 leading-7")} />
          </div>
          {golden ? (
            <div>
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--g-line)] p-3.5 text-[14px] leading-7">
                <input type="checkbox" name="consent" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} className="mt-1.5 size-5 shrink-0 accent-[var(--g-accent)]" {...inv("consent")} />
                <span>أوافق على التعاون مع Colapia بعد التسليم: فيديو Collab أو شهادة عن التجربة، وبعد موافقتي على النسخة النهائية قبل أي نشر.</span>
              </label>
              {err("consent")}
            </div>
          ) : null}
        </div>
      </section>

      <section className={card}>
        <h2 className="text-lg font-black">الدفع</h2>
        <p className="mt-1 text-[14px] leading-7 text-[var(--g-muted)]">حوّلوا <b className="text-[var(--g-fg)]">{price} جنيه</b> ثم ارفعوا صورة الإيصال. لا يدخل الحجز حيز التنفيذ إلا بعد أن نؤكد التحويل.</p>
        <fieldset className="mt-4">
          <legend className="text-[13px] font-bold">وسيلة التحويل</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {(["vodafone_cash", "instapay"] as const).map((m) => (
              <label key={m} className={cn("flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-[14px] font-bold", method === m ? "border-[var(--g-accent)] bg-[var(--g-accent)]/10" : "border-[var(--g-line)]")}>
                <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="size-4 accent-[var(--g-accent)]" />
                {METHOD_LABEL[m]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--g-accent)]/10 p-3.5">
          <div>
            <p className="text-[12.5px] text-[var(--g-muted)]">{method === "vodafone_cash" ? "رقم المحفظة" : "رقم الحساب أو العنوان"}</p>
            <p dir="ltr" className="text-start text-xl font-black tracking-wide">{/^\d{11}$/.test(numberFor) ? prettyPhone(numberFor) : numberFor}</p>
          </div>
          <CopyNumber value={numberFor} />
        </div>
        <div className="mt-4">
          <label htmlFor="senderPhone" className="text-[13px] font-bold">الرقم الذي حوّلتم منه</label>
          <input id="senderPhone" name="senderPhone" type="tel" inputMode="tel" dir="ltr" value={sender} onChange={(e) => { setSender(e.target.value); setErrors((x) => ({ ...x, senderPhone: undefined, form: undefined })); }} placeholder="01XXXXXXXXX" className={cn(field, "text-start")} {...inv("senderPhone")} />
          {err("senderPhone")}
        </div>
        <div className="mt-4">
          <p className="text-[13px] font-bold">صورة الإيصال</p>
          {receipt ? (
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-[var(--g-line)] p-3">
              {/* معاينة محلية من الجهاز قبل الإرسال: لا تحتاج تحسين صور */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={receipt.preview} alt="معاينة الإيصال" className="size-20 rounded-xl object-cover" />
              <div className="min-w-0 flex-1 text-[13px] font-bold text-[var(--g-ok)]">رُفع الإيصال</div>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(receipt.preview);
                  setReceipt(null);
                }}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-[var(--g-line)] px-3 text-[13px] font-bold"
              >
                <Trash2 className="size-4" aria-hidden="true" /> إزالة
              </button>
            </div>
          ) : (
            <label className={cn("mt-2 flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--g-line)] p-4 text-center text-[14px] font-bold", uploading && "opacity-60")}>
              {uploading ? <Loader2 className="size-6 animate-spin" aria-hidden="true" /> : <ImagePlus className="size-6" aria-hidden="true" />}
              {uploading ? "جارٍ الرفع…" : "اضغطوا لاختيار صورة الإيصال"}
              <input type="file" name="receipt" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => { void pickReceipt(e.target.files); e.currentTarget.value = ""; }} />
            </label>
          )}
          {err("receipt")}
        </div>
      </section>

      {/* فخ للبرامج الآلية: حقل لا يراه الإنسان */}
      <div aria-hidden="true" className="absolute -start-[9999px] h-0 w-0 overflow-hidden">
        <label>
          الموقع الإلكتروني
          <input tabIndex={-1} autoComplete="off" name="website" value={honey} onChange={(e) => setHoney(e.target.value)} />
        </label>
      </div>

      {errors.form ? (
        <p data-form-error tabIndex={-1} role="alert" className="rounded-2xl border border-[var(--g-bad)]/50 bg-[var(--g-bad)]/10 p-3.5 text-[14px] font-bold leading-7 text-[var(--g-bad)]">
          {errors.form}
        </p>
      ) : null}

      <button type="submit" disabled={sending || uploading} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--g-accent)] px-6 text-[16px] font-black text-[var(--g-on-accent)] disabled:opacity-60">
        {sending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
        {sending ? "جارٍ الإرسال…" : "إرسال الحجز"}
      </button>
      <p className="text-center text-[12.5px] leading-6 text-[var(--g-muted)]">بإرسال الحجز توافقون على <a href="/terms" className="underline">الشروط</a> و<a href="/privacy" className="underline">سياسة الخصوصية</a>.</p>
    </form>
  );
}
