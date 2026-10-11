"use client";

// PhotoLines.tsx — المنتجات كصورة + سطر واحد («تيشيرت قطن، أسود/أبيض، M L XL، 350»). الفريق يحلل السطر.
import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MAX_PRODUCTS, type IntakeData, type IntakeProductLine } from "@/intake/schema";
import { inputCls } from "./ui";
import { newId, prepareImage, uploadErrorMessage, uploadIntakeImage } from "./upload";

type Props = {
  items: IntakeProductLine[];
  urls: Record<string, string>;
  setUrl: (key: string, url: string) => void;
  update: (fn: (d: IntakeData) => IntakeData) => void;
  ensureToken: () => Promise<string | null>;
};

export function PhotoLines({ items, urls, setUrl, update, ensureToken }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<Record<string, string>>({});

  const setItems = (fn: (list: IntakeProductLine[]) => IntakeProductLine[]) =>
    update((d) => ({ ...d, products: { ...d.products, mode: "list", items: fn(d.products.items).slice(0, MAX_PRODUCTS) } }));

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_PRODUCTS - items.length;
    if (room <= 0) return void toast.error(`الحد الأقصى ${MAX_PRODUCTS} منتجاً. الباقي ضيفه بنفسك من لوحتك بعد التسليم.`);
    const token = await ensureToken();
    if (!token) return void toast.error("ما قدرناش نجهز الرفع. تأكد من النت وجرّب تاني.");
    const picked = Array.from(files).slice(0, room);
    const fresh = picked.map((f) => ({ id: newId(), preview: URL.createObjectURL(f), file: f }));
    setItems((list) => [...list, ...fresh.map((x) => ({ id: x.id, line: "" }))]);
    setBusy((b) => ({ ...b, ...Object.fromEntries(fresh.map((x) => [x.id, x.preview])) }));
    for (const x of fresh) {
      try {
        const { key, url } = await uploadIntakeImage(token, await prepareImage(x.file), "image");
        setUrl(key, url);
        setItems((list) => list.map((p) => (p.id === x.id ? { ...p, key } : p)));
      } catch (e) {
        toast.error(uploadErrorMessage(e, "فشل رفع صورة، جرّب تاني."));
        setItems((list) => list.filter((p) => p.id !== x.id || Boolean(p.line?.trim())));
      } finally {
        URL.revokeObjectURL(x.preview);
        setBusy((b) => {
          const { [x.id]: _, ...rest } = b;
          return rest;
        });
      }
    }
  };

  return (
    <div className="space-y-3">
      {items.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((p, i) => {
            const preview = busy[p.id];
            const src = p.key ? urls[p.key] : undefined;
            return (
              <li key={p.id} className="flex gap-3 rounded-2xl border border-edge/10 bg-edge/[0.03] p-2.5">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-edge/[0.06]">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="size-full object-cover opacity-60" />
                  ) : src ? (
                    <Image src={src} alt={p.line || `منتج ${i + 1}`} fill sizes="80px" className="object-cover" unoptimized />
                  ) : (
                    <span className="grid size-full place-items-center text-ink-3">
                      <ImagePlus className="size-6" aria-hidden="true" />
                    </span>
                  )}
                  {preview ? (
                    <span className="absolute inset-0 grid place-items-center">
                      <Loader2 className="size-6 animate-spin text-white" aria-label="بنرفع الصورة" />
                    </span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <label className="sr-only" htmlFor={`line-${p.id}`}>
                    وصف المنتج {i + 1}
                  </label>
                  <input
                    id={`line-${p.id}`}
                    value={p.line ?? ""}
                    maxLength={200}
                    onChange={(e) => setItems((list) => list.map((x) => (x.id === p.id ? { ...x, line: e.target.value } : x)))}
                    placeholder="مثلاً: تيشيرت قطن، أسود/أبيض، M L XL، 350"
                    className={`${inputCls} h-11 text-[15px]`}
                  />
                  <button
                    type="button"
                    onClick={() => setItems((list) => list.filter((x) => x.id !== p.id))}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[12.5px] font-bold text-ink-3 hover:text-rose-400"
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" /> احذف
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-nova/40 bg-nova/[0.06] px-4 text-[14px] font-black text-nova-2 transition hover:bg-nova/[0.12] sm:flex-none"
        >
          <ImagePlus className="size-5" aria-hidden="true" />
          {items.length ? "أضف صور كمان" : "أضف صور منتجاتك"}
        </button>
        <button
          type="button"
          onClick={() => setItems((list) => [...list, { id: newId(), line: "" }])}
          className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border border-edge/10 px-4 text-[13.5px] font-bold text-ink-2 hover:border-edge/25 hover:text-ink"
        >
          <Plus className="size-4" aria-hidden="true" /> منتج بدون صورة
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => (void add(e.target.files), (e.target.value = ""))} />
    </div>
  );
}
