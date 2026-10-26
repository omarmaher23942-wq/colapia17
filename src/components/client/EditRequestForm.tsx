"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { ImagePlus, Loader2, Send } from "lucide-react";
import { uploadDirect } from "@/lib/media-upload";
import { submitEditRequestAction } from "@/server/actions/client-portal";

const field = "mt-1.5 block w-full rounded-xl border border-edge/15 bg-transparent px-3.5 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-nova";

export type EditFormProject = { id: string; name: string; free: boolean; fee: number; untilText: string | null; reason: "window_closed" | "free_used" | null };

async function shrink(f: File): Promise<File> {
  try {
    const c = await imageCompression(f, { maxSizeMB: 1.5, maxWidthOrHeight: 2400, useWebWorker: false, initialQuality: 0.9 });
    return new File([c], f.name.replace(/\.\w+$/, "") + ".jpg", { type: c.type || "image/jpeg" });
  } catch {
    return f;
  }
}

/** طلب تعديل: مجاني إن كان داخل النافذة ولم يُستهلك، وإلا بمبلغ ثابت من الخادم ووسيلة تحويل وإيصال. */
export function EditRequestForm({ projects, selected, pay }: { projects: EditFormProject[]; selected: string; pay: { vodafone: string; instapay: string } }) {
  const router = useRouter();
  const [pid, setPid] = useState(selected);
  const p = projects.find((x) => x.id === pid) ?? projects[0]!;
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [files, setFiles] = useState<{ url: string; name: string }[]>([]);
  const [method, setMethod] = useState<"vodafone_cash" | "instapay">("vodafone_cash");
  const [sender, setSender] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    setError("");
    try {
      const done = await uploadDirect("editFile", await Promise.all(Array.from(list).slice(0, 6).map(shrink)));
      setFiles((f) => [...f, ...done.map((d) => ({ url: d.url, name: d.name }))].slice(0, 6));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر رفع الملفات.");
    }
    setBusy(false);
  }
  async function addReceipt(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      const [d] = await uploadDirect("clientReceipt", [await shrink(f)]);
      setReceipt(d?.url ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر رفع الإيصال.");
    }
    setBusy(false);
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const r = await submitEditRequestAction({ requestId: p.id, title, details, files, payment: p.free ? undefined : { method, senderPhone: sender, receiptUrl: receipt ?? "" } });
      if (!r.ok) return setError(r.error);
      router.push("/dashboard/history");
    });
  };

  const number = method === "vodafone_cash" ? pay.vodafone : pay.instapay;
  return (
    <form onSubmit={submit} className="dash-card space-y-4 p-5" noValidate>
      <h1 className="text-xl font-black">طلب تعديل</h1>
      {projects.length > 1 ? (
        <label className="block text-[13px] font-bold">
          المشروع
          <select value={pid} onChange={(e) => setPid(e.target.value)} className={`${field} h-12`}>
            {projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
      ) : null}
      <p className="rounded-xl bg-nova/10 p-3 text-[13.5px] leading-7">
        {p.free
          ? `هذا التعديل مجاني (تعديل واحد خلال المدة المحددة${p.untilText ? ` حتى ${p.untilText}` : ""}).`
          : `${p.reason === "free_used" ? "استُهلك التعديل المجاني." : "انتهت مدة التعديل المجاني."} رسوم هذا التعديل ${p.fee.toLocaleString("en-US")} ج، تحوّلونها وترفعون الإيصال ونبدأ التنفيذ بعد تأكيده.`}
      </p>
      <label className="block text-[13px] font-bold">
        عنوان التعديل
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={`${field} h-12`} />
      </label>
      <label className="block text-[13px] font-bold">
        تفاصيل المطلوب
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={6} maxLength={6000} placeholder="اشرحوا ما تريدون تغييره بالتفصيل، وأين." className={`${field} py-3 leading-7`} />
      </label>
      <div>
        <p className="text-[13px] font-bold">صور أو ملفات توضيحية (اختياري)</p>
        <label className="mt-1.5 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-edge/15 px-4 text-[13px] font-bold">
          <ImagePlus className="size-4" aria-hidden="true" /> إضافة صور
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void addFiles(e.target.files); e.currentTarget.value = ""; }} />
        </label>
        {files.length ? <p className="mt-1 text-[12.5px] text-ink-3">{files.length} ملف مرفوع</p> : null}
      </div>
      {!p.free ? (
        <fieldset className="space-y-3 rounded-2xl border border-edge/15 p-4">
          <legend className="px-1 text-[13px] font-black">الدفع</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["vodafone_cash", "instapay"] as const).map((m) => (
              <label key={m} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border border-edge/15 px-3 text-[14px] font-bold">
                <input type="radio" name="m" checked={method === m} onChange={() => setMethod(m)} /> {m === "vodafone_cash" ? "فودافون كاش" : "إنستاباي"}
              </label>
            ))}
          </div>
          <p className="text-[14px]">حوّلوا <b>{p.fee.toLocaleString("en-US")} ج</b> إلى <b dir="ltr">{number}</b></p>
          <label className="block text-[13px] font-bold">
            الرقم الذي حوّلتم منه
            <input value={sender} onChange={(e) => setSender(e.target.value)} dir="ltr" inputMode="tel" placeholder="01XXXXXXXXX" className={`${field} h-12 text-start`} />
          </label>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-edge/15 px-4 text-[13px] font-bold">
            <ImagePlus className="size-4" aria-hidden="true" /> {receipt ? "تم رفع الإيصال (اضغطوا للاستبدال)" : "رفع صورة الإيصال"}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => { void addReceipt(e.target.files); e.currentTarget.value = ""; }} />
          </label>
        </fieldset>
      ) : null}
      {error ? <p role="alert" className="text-[13.5px] font-bold text-bad">{error}</p> : null}
      <button type="submit" disabled={pending || busy || (!p.free && !receipt)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-nova px-6 text-[14px] font-black text-white disabled:opacity-50">
        {pending || busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />} إرسال الطلب
      </button>
    </form>
  );
}
