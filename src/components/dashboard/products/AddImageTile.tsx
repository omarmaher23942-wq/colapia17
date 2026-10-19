"use client";

// AddImageTile — الصورة البديلة لمنتج بلا صورة صارت زراً: الضغط عليها يفتح اختيار الكاميرا أو المعرض مباشرة، ثم تُرفع الصورة
// (مع الضغط في المتصفح) وتُحفظ على المنتج وتظهر فوراً. في المتجر نفسه لا تظهر هذه الأداة أبداً (للتاجر في لوحته فقط).
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { addProductImageAction } from "@/server/actions/products";
import { uploadImages } from "@/components/onboarding/upload";

export function AddImageTile({ productId, name, className, iconClass = "size-5" }: { productId: string; name: string; className?: string; iconClass?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (ref.current) ref.current.value = "";
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(f.type) && !/\.(jpe?g|png|webp)$/i.test(f.name)) return void toast.error("الصيغ المقبولة: JPG أو PNG أو WEBP.");
    setBusy(true);
    try {
      const up = await uploadImages([f], { cleanup: true });
      const url = up.urls[0];
      if (!url) return void toast.error(up.error ?? "تعذر رفع الصورة. تأكدوا من الاتصال وحاولوا مرة أخرى.");
      const r = await addProductImageAction(productId, url);
      if (!r.ok) return void toast.error(r.error);
      toast.success("أُضيفت الصورة");
      router.refresh();
    } catch {
      toast.error("تعذر إضافة الصورة. تأكدوا من الاتصال وحاولوا مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void pick(e.target.files)} />
      <button
        type="button"
        disabled={busy}
        onClick={() => ref.current?.click()}
        aria-label={`إضافة صورة للمنتج ${name}`}
        title="إضافة صورة"
        className={cn("grid shrink-0 place-items-center rounded-xl border border-dashed border-nova/40 bg-nova/[0.05] text-nova-2 transition hover:bg-nova/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nova/50 disabled:opacity-70", className)}
      >
        {busy ? <Loader2 className={cn(iconClass, "animate-spin")} aria-hidden="true" /> : <Camera className={iconClass} strokeWidth={1.75} aria-hidden="true" />}
      </button>
    </>
  );
}
