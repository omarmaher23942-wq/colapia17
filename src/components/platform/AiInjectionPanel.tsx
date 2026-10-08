"use client";

import { useState, useTransition } from "react";
import {
  Copy, Check, Plus, Trash2, Send, Pause, Timer, Sparkles, Wand2, Image as ImageIcon,
  AlertCircle, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  addDirectiveAction,
  updateDirectiveAction,
  deleteDirectiveAction,
  sendToBuildAction,
  pauseReviewTimerAction,
  resumeReviewTimerAction,
} from "@/server/actions/platform-review";

const SW = 1.75;

export type Directive = {
  id: string;
  scope: "store" | "product";
  productSourceId: string | null;
  instruction: string;
  imageUrls: string[];
  enabled: boolean;
};

export function AiInjectionPanel({
  storeId,
  initialDirectives,
  reviewDeadlineAt,
  onSubmitted,
}: {
  storeId: string;
  initialDirectives: Directive[];
  reviewDeadlineAt: string | null;
  onSubmitted?: () => void;
}) {
  const [directives, setDirectives] = useState<Directive[]>(initialDirectives);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [deadline, setDeadline] = useState<string | null>(reviewDeadlineAt);

  const addField = () =>
    start(async () => {
      const r = await addDirectiveAction({
        storeId,
        scope: "store",
        instruction: "اكتب تعليماتك للـ AI هنا",
        imageUrls: [],
      });
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      if ("id" in r) {
        setDirectives((d) => [
          ...d,
          { id: r.id!, scope: "store", productSourceId: null, instruction: "اكتب تعليماتك للـ AI هنا", imageUrls: [], enabled: true },
        ]);
        toast.success("أُضيف حقل جديد");
      }
    });

  const updateField = (id: string, patch: Partial<Directive>) => {
    setDirectives((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const persistField = (id: string, patch: Partial<Directive>) =>
    start(async () => {
      const r = await updateDirectiveAction(id, patch);
      if ("error" in r && r.error) toast.error(r.error);
    });

  const removeField = (id: string) =>
    start(async () => {
      const r = await deleteDirectiveAction(id);
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      setDirectives((d) => d.filter((x) => x.id !== id));
      toast.success("حُذف الحقل");
    });

  const copyAll = async () => {
    const text = directives
      .filter((d) => d.instruction.trim())
      .map((d, i) => `${i + 1}) ${d.instruction}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("نُسخت كل التعليمات");
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  const submit = () =>
    start(async () => {
      const r = await sendToBuildAction(storeId);
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("أُرسل للبناء");
      onSubmitted?.();
    });

  const pause = () =>
    start(async () => {
      const r = await pauseReviewTimerAction(storeId);
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      setDeadline(null);
      toast.success("أُوقف المؤقت");
    });

  const resume = () =>
    start(async () => {
      const r = await resumeReviewTimerAction(storeId, 12);
      if ("error" in r && r.error) {
        toast.error(r.error);
        return;
      }
      if ("deadline" in r && r.deadline) setDeadline(r.deadline);
      toast.success("أُعيد ضبط المؤقت");
    });

  return (
    <div className="space-y-3">
      {/* Header: Copy-all + Timer */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#232b66] bg-[#0c1029] p-3">
        <button
          type="button"
          onClick={copyAll}
          disabled={pending || directives.length === 0}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-40",
            copied
              ? "border-[#8fa8ff] bg-[#6f86ff]/15 text-[#eaf0ff]"
              : "border-[#232b66] bg-[#10153a] text-[#c3cdf0] hover:border-[#3f4fbf] hover:text-[#eaf0ff]"
          )}
        >
          {copied ? <Check className="size-3.5" strokeWidth={SW} /> : <Copy className="size-3.5" strokeWidth={SW} />}
          {copied ? "نُسخ" : "نسخ كل التعليمات"}
        </button>

        <div className="ms-auto flex items-center gap-2 text-xs">
          <Timer className="size-3.5 text-[#8fa8ff]" strokeWidth={SW} />
          {deadline ? (
            <>
              <span className="tabular-nums text-[#c3cdf0]">
                إرسال تلقائي خلال {formatRemaining(deadline)}
              </span>
              <button
                type="button"
                onClick={pause}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-md border border-[#232b66] bg-[#10153a] px-2 py-1 font-bold text-[#c3cdf0] hover:border-[#3f4fbf] hover:text-[#eaf0ff] disabled:opacity-40"
              >
                <Pause className="size-3" strokeWidth={SW} />
                إيقاف
              </button>
            </>
          ) : (
            <>
              <span className="text-[#8d97c4]">المؤقت موقوف</span>
              <button
                type="button"
                onClick={resume}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-md border border-[#232b66] bg-[#10153a] px-2 py-1 font-bold text-[#c3cdf0] hover:border-[#3f4fbf] hover:text-[#eaf0ff] disabled:opacity-40"
              >
                <Timer className="size-3" strokeWidth={SW} />
                استئناف (12h)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Directives */}
      {directives.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#232b66] p-6 text-center">
          <Sparkles className="mx-auto size-6 text-[#6f86ff]" strokeWidth={SW} />
          <p className="mt-2 text-xs font-bold text-[#c3cdf0]">لا حقول بعد</p>
          <p className="mt-1 text-[11px] text-[#8d97c4]">
            أضف حقلاً واكتب فيه تعليماتك للـ AI مع صور اختيارية.
          </p>
        </div>
      )}

      {directives.map((d, idx) => (
        <DirectiveCard
          key={d.id}
          index={idx}
          directive={d}
          onChange={(patch) => updateField(d.id, patch)}
          onPersist={(patch) => persistField(d.id, patch)}
          onRemove={() => removeField(d.id)}
          storeId={storeId}
        />
      ))}

      <button
        type="button"
        onClick={addField}
        disabled={pending}
        className="w-full rounded-xl border-2 border-dashed border-[#232b66] py-3 text-sm font-bold text-[#8d97c4] transition-colors hover:border-[#8fa8ff]/60 hover:text-[#eaf0ff] disabled:opacity-40"
      >
        <Plus className="inline size-4 me-1.5" strokeWidth={SW} />
        إضافة حقل للـ AI
      </button>

      {/* Submit */}
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#eaf0ff] to-[#c3cdf0] px-5 py-3 text-sm font-bold text-[#07091a] shadow-[inset_0_0_0_1px_rgb(234_240_255/.35),0_10px_30px_-10px_rgb(143_168_255/.45)] transition-all hover:brightness-105 active:scale-[.98] disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={SW} />
        ) : (
          <Wand2 className="size-4" strokeWidth={SW} />
        )}
        إرسال للبناء
      </button>
    </div>
  );
}

function DirectiveCard({
  index,
  directive,
  onChange,
  onPersist,
  onRemove,
  storeId,
}: {
  index: number;
  directive: Directive;
  onChange: (patch: Partial<Directive>) => void;
  onPersist: (patch: Partial<Directive>) => void;
  onRemove: () => void;
  storeId: string;
}) {
  const [open, setOpen] = useState(true);
  const [uploading, setUploading] = useState(false);

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const { uploadFiles } = await import("@/lib/uploadthing-client-direct");
      const res = await uploadFiles("brandAsset", { files: Array.from(files).slice(0, 6) });
      const urls = res.map((r: any) => r.ufsUrl ?? r.url).filter(Boolean);
      const next = [...directive.imageUrls, ...urls].slice(0, 6);
      onChange({ imageUrls: next });
      onPersist({ imageUrls: next });
    } catch {
      toast.error("فشل الرفع");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (url: string) => {
    const next = directive.imageUrls.filter((u) => u !== url);
    onChange({ imageUrls: next });
    onPersist({ imageUrls: next });
  };

  return (
    <div className="rounded-xl border border-[#232b66] bg-[#0c1029] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md bg-[#6f86ff]/15 text-[10px] font-bold text-[#8fa8ff]">
          {index + 1}
        </span>
        <span className="text-xs font-bold text-[#eaf0ff]">حقل #{index + 1}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ms-auto grid size-7 place-items-center rounded-md text-[#c3cdf0] hover:bg-[#181e4d]"
          aria-label={open ? "طي" : "فتح"}
        >
          {open ? <ChevronUp className="size-3.5" strokeWidth={SW} /> : <ChevronDown className="size-3.5" strokeWidth={SW} />}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="grid size-7 place-items-center rounded-md text-[#ff5c6c] hover:bg-[#ff5c6c]/10"
          aria-label="حذف الحقل"
        >
          <Trash2 className="size-3.5" strokeWidth={SW} />
        </button>
      </div>

      {open && (
        <div className="space-y-2">
          <textarea
            rows={4}
            value={directive.instruction}
            onChange={(e) => onChange({ instruction: e.target.value })}
            onBlur={(e) => onPersist({ instruction: e.target.value })}
            placeholder="اكتب تعليماتك للـ AI هنا. مثال: استخدم صور الإلهام المرفقة لبناء قسم About، وخذ من النص التالي..."
            className="w-full rounded-lg border border-[#232b66] bg-[#10153a] p-3 text-xs leading-6 text-[#eaf0ff] outline-none placeholder:text-[#6f7aa8] focus:border-[#8fa8ff]"
          />

          {directive.imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {directive.imageUrls.map((url) => (
                <div key={url} className="group relative size-16 overflow-hidden rounded-lg border border-[#232b66]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="absolute top-0.5 end-0.5 grid size-5 place-items-center rounded-full bg-[#ff5c6c] text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="حذف الصورة"
                  >
                    <Trash2 className="size-3" strokeWidth={SW} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#232b66] bg-[#10153a] px-3 py-1.5 text-xs font-bold text-[#c3cdf0] transition-colors hover:border-[#3f4fbf] hover:text-[#eaf0ff]">
            <ImageIcon className="size-3.5" strokeWidth={SW} />
            {uploading ? "يرفع…" : "إضافة صور"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void onUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function formatRemaining(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "الآن";
  const h = Math.floor(ms / 36e5);
  const m = Math.floor(ms / 6e4) % 60;
  if (h > 0) return `${h}س ${m}د`;
  return `${m}د`;
}