"use client";

// ImageUploader: سحب وإفلات + إعادة ترتيب + تحديد الصورة الأساسية بالنقر
// + ضغط Client-side + مؤشر تقدم الرفع.
import { useRef, useState } from "react";
import {
  Plus,
  X,
  Loader2,
  Image as ImageIcon,
  Star,
  GripVertical,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import { useUploadThing } from "@/lib/uploadthing-client";
import { cn } from "@/lib/utils";
import type { OnboardingAsset } from "@/onboarding/schema";

const SW = 1.75;

function newId() {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
}

export function ImageUploader({
  token,
  value,
  onChange,
  primaryImageId,
  onSetPrimary,
  max = 6,
  label = "أضف صور المنتج",
  hint,
}: {
  token: string;
  value: OnboardingAsset[];
  onChange: (v: OnboardingAsset[]) => void;
  primaryImageId?: string;
  onSetPrimary?: (id: string) => void;
  max?: number;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropZoneActive, setDropZoneActive] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);

  const { startUpload } = useUploadThing("onboardingImage", {
    onClientUploadComplete: (res) => {
      const added: OnboardingAsset[] = res.map((r) => ({
        id: newId(),
        url: r.ufsUrl ?? r.url,
        key: r.key,
        alt: "",
      }));
      const next = [...value, ...added].slice(0, max);
      onChange(next);
      if (!primaryImageId && next[0] && onSetPrimary) {
        onSetPrimary(next[0].id);
      }
    },
    onUploadError: (e) => {
      toast.error(e?.message || "فشل رفع الصورة.");
    },
  });

  const processFiles = async (files: File[]) => {
    const remaining = Math.max(0, max - value.length);
    if (remaining <= 0) {
      toast.error(`الحد الأقصى ${max} صور.`);
      return;
    }
    const picked = files.slice(0, remaining);

    const compressed = await Promise.all(
      picked.map(async (f) => {
        try {
          const c = await imageCompression(f, {
            maxSizeMB: 0.6,
            maxWidthOrHeight: 1600,
            useWebWorker: true,
          });
          return new File([c], f.name, { type: c.type || f.type });
        } catch {
          return f;
        }
      })
    );

    setUploadingCount(compressed.length);
    for (const file of compressed) {
      try {
        await startUpload([file], { token });
      } catch {
        // already handled by onUploadError
      }
      setUploadingCount((n) => Math.max(0, n - 1));
    }
  };

  const onPick = async (files: FileList | null) => {
    if (!files?.length) return;
    await processFiles(Array.from(files));
  };

  const removeAt = (i: number) => onChange(value.filter((_, k) => k !== i));

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = [...value];
    const [m] = next.splice(from, 1);
    if (!m) return;
    next.splice(to, 0, m);
    onChange(next);
  };

  const remaining = Math.max(0, max - value.length);
  const uploadingSlots = Math.min(uploadingCount, remaining);

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDropZoneActive(true);
        }}
        onDragLeave={() => setDropZoneActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropZoneActive(false);
          const files = Array.from(e.dataTransfer.files).filter((f) =>
            f.type.startsWith("image/")
          );
          if (files.length) void processFiles(files);
        }}
        className={cn(
          "grid grid-cols-3 gap-2 rounded-2xl border-2 border-dashed p-2 transition-colors sm:grid-cols-4",
          dropZoneActive
            ? "border-[#8fa8ff] bg-[#6f86ff]/[0.06]"
            : "border-transparent"
        )}
      >
        {value.map((img, i) => {
          const isPrimary = img.id === primaryImageId;
          return (
            <div
              key={img.id}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (dragIdx !== null) reorder(dragIdx, i);
                setDragIdx(null);
              }}
              onDragEnd={() => setDragIdx(null)}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-xl border bg-[#0c1029] transition-all",
                isPrimary
                  ? "border-[#8fa8ff] shadow-[0_0_0_2px_rgba(143,168,255,0.25)]"
                  : dragIdx === i
                    ? "border-[#8fa8ff] opacity-70"
                    : "border-[#232b66] hover:border-[#3f4fbf]"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.alt ?? ""}
                className="size-full object-cover"
              />

              {/* Overlay controls */}
              <div className="absolute inset-x-0 top-0 flex items-start justify-between p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <span
                  aria-hidden="true"
                  className="cursor-grab rounded-md bg-black/60 p-1 text-white backdrop-blur"
                >
                  <GripVertical className="size-3" strokeWidth={SW} />
                </span>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  aria-label="حذف الصورة"
                  className="grid size-7 place-items-center rounded-full bg-[#ff5c6c] text-white transition-colors hover:bg-[#ff5c6c]/80"
                >
                  <X className="size-3.5" strokeWidth={SW} />
                </button>
              </div>

              {/* Primary toggle */}
              {onSetPrimary ? (
                <button
                  type="button"
                  onClick={() => onSetPrimary(img.id)}
                  aria-label={
                    isPrimary ? "الصورة الأساسية" : "اجعلها الصورة الأساسية"
                  }
                  className={cn(
                    "absolute inset-x-1 bottom-1 inline-flex h-7 items-center justify-center gap-1 rounded-md text-[10px] font-bold transition-colors",
                    isPrimary
                      ? "bg-[#6f86ff] text-[#07091a]"
                      : "bg-black/60 text-white/90 backdrop-blur hover:bg-black/80"
                  )}
                >
                  <Star
                    className="size-2.5"
                    strokeWidth={2.5}
                    fill={isPrimary ? "currentColor" : "none"}
                  />
                  {isPrimary ? "أساسية" : "تعيين"}
                </button>
              ) : null}
            </div>
          );
        })}

        {/* Uploading placeholders */}
        {Array.from({ length: uploadingSlots }).map((_, i) => (
          <div
            key={`up-${i}`}
            className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-[#6f86ff]/50 bg-[#6f86ff]/5"
          >
            <Loader2 className="size-5 animate-spin text-[#8fa8ff]" strokeWidth={SW} />
          </div>
        ))}

        {/* Add tile */}
        {value.length < max && uploadingSlots === 0 ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid aspect-square place-items-center gap-1 rounded-xl border-2 border-dashed border-[#232b66] bg-[#0c1029] text-xs font-bold text-[#8d97c4] transition-colors hover:border-[#8fa8ff]/60 hover:text-[#eaf0ff]"
          >
            {value.length === 0 ? (
              <>
                <ImageIcon
                  className="size-6 text-[#6f86ff]"
                  strokeWidth={SW}
                  aria-hidden="true"
                />
                <span className="text-[11px]">{label}</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-[#8d97c4]/80">
                  <Upload className="size-2.5" strokeWidth={SW} />
                  أو اسحب الصور هنا
                </span>
              </>
            ) : (
              <>
                <Plus className="size-5" strokeWidth={SW} aria-hidden="true" />
                <span className="text-[11px]">أضف</span>
              </>
            )}
          </button>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void onPick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <p className="text-[11px] leading-4 text-[#8d97c4]">
        {hint ??
          `حتى ${max} صور · اضغط "تعيين" لاختيار الصورة الأساسية · اسحب لإعادة الترتيب.`}
      </p>
    </div>
  );
}