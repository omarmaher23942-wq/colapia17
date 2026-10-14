"use client";

// ProductsEditor.tsx — منتجات الاستمارة: زر «إضافة منتج» يفتح بطاقة فيها خانة كتابة إلزامية (لون، مقاس، سعر، تفاصيل، أي
// كلام) وصور اختيارية خاصة بهذا المنتج (حتى 10). لا أكثر. الصورة تظهر فور اختيارها من الجهاز نفسه (معاينة محلية)
// ثم ترتفع في الخلفية، فلا تنتظر العميل ولا تختفي إن تأخر العرض من مساحة الملفات. حتى 6 منتجات، والباقي من لوحة التحكم.
import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";
import { MAX_PRODUCT_IMAGES, MAX_PRODUCTS, PRODUCT_TEXT_MAX, SUGGESTED_PRODUCTS, type IntakeData, type IntakeErrors, type IntakeProductLine } from "@/intake/schema";
import { cn } from "@/lib/utils";
import { ErrorText } from "./ui";
import { newId, prepareImage, uploadErrorMessage, uploadIntakeImage } from "./upload";

type Props = {
  items: IntakeProductLine[];
  errors: IntakeErrors;
  urls: Record<string, string>;
  setUrl: (key: string, url: string) => void;
  update: (fn: (d: IntakeData) => IntakeData) => void;
  ensureToken: () => Promise<string | null>;
  /** +1 عند بدء رفع و-1 عند انتهائه (الإرسال ينتظر الرفع حتى لا تضيع صورة). */
  onBusy: (delta: 1 | -1) => void;
  /** تلميح تحت القائمة (الدائرة الذهبية تطلب 3 على الأقل). */
  hint?: string;
  textPlaceholder?: string;
};

type Pending = { id: string; preview: string };

const textareaCls =
  "w-full rounded-xl border border-edge/10 bg-edge/[0.04] p-3 text-[16px] font-bold leading-7 text-ink outline-none transition placeholder:font-medium placeholder:text-ink-3/60 focus:border-nova focus:ring-2 focus:ring-nova/25 aria-[invalid=true]:border-rose-400/70 sm:text-[15px]";

export function ProductsEditor({ items, errors, urls, setUrl, update, ensureToken, onBusy, hint, textPlaceholder }: Props) {
  // أول بطاقة جاهزة للكتابة بلا ضغطة: بطاقة افتراضية لا تدخل البيانات (ولا تنشئ مسودة) حتى يكتب العميل أو يضيف صورة.
  const virtualId = `p${useId().replace(/[^a-z0-9]/gi, "")}`;
  const list: IntakeProductLine[] = items.length ? items : [{ id: virtualId, text: "", images: [] }];
  const [focusId, setFocusId] = useState<string | null>(null);

  const patch = (id: string, fn: (p: IntakeProductLine) => IntakeProductLine) =>
    update((d) => {
      const exists = d.products.items.some((p) => p.id === id);
      const base = exists ? d.products.items : [...d.products.items, { id, text: "", images: [] }];
      return { ...d, products: { ...d.products, items: base.map((p) => (p.id === id ? fn(p) : p)).slice(0, MAX_PRODUCTS) } };
    });

  const add = () => {
    if (items.length >= MAX_PRODUCTS) return;
    const id = newId();
    update((d) => ({ ...d, products: { ...d.products, items: [...d.products.items, { id, text: "", images: [] }].slice(0, MAX_PRODUCTS) } }));
    setFocusId(id);
  };
  const remove = (id: string) => update((d) => ({ ...d, products: { ...d.products, items: d.products.items.filter((p) => p.id !== id) } }));

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {list.map((p, i) => (
          <ProductCard
            key={p.id}
            index={i}
            product={p}
            error={errors[`products.${p.id}`]}
            urls={urls}
            setUrl={setUrl}
            ensureToken={ensureToken}
            onBusy={onBusy}
            textPlaceholder={textPlaceholder}
            autoFocus={focusId === p.id}
            canRemove={items.length > 0}
            onText={(text) => patch(p.id, (x) => ({ ...x, text }))}
            onAddImage={(key) => patch(p.id, (x) => (x.images.includes(key) || x.images.length >= MAX_PRODUCT_IMAGES ? x : { ...x, images: [...x.images, key] }))}
            onRemoveImage={(key) => patch(p.id, (x) => ({ ...x, images: x.images.filter((k) => k !== key) }))}
            onRemove={() => remove(p.id)}
          />
        ))}
      </ul>

      {items.length ? (
        <button
          type="button"
          onClick={add}
          disabled={items.length >= MAX_PRODUCTS}
          className={cn(
            "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-dashed px-4 text-[15px] font-black transition",
            items.length >= MAX_PRODUCTS ? "cursor-not-allowed border-edge/10 text-ink-3 opacity-60" : "border-nova/40 bg-nova/[0.06] text-nova-2 hover:bg-nova/[0.12]",
          )}
        >
          <Plus className="size-5" aria-hidden="true" />
          {items.length >= MAX_PRODUCTS ? `وصلت لـ ${MAX_PRODUCTS} منتجات` : "إضافة منتج"}
        </button>
      ) : null}
      <p className="text-[12.5px] leading-6 text-ink-3">{hint ?? `الأفضل ${SUGGESTED_PRODUCTS} إلى ${MAX_PRODUCTS} منتجات. الباقي تضيفه بنفسك من لوحة التحكم بعد التسليم.`}</p>
      <ErrorText>{errors.products}</ErrorText>
    </div>
  );
}

function ProductCard({
  index,
  product,
  error,
  urls,
  setUrl,
  ensureToken,
  onBusy,
  textPlaceholder,
  autoFocus,
  canRemove,
  onText,
  onAddImage,
  onRemoveImage,
  onRemove,
}: {
  index: number;
  product: IntakeProductLine;
  error?: string;
  urls: Record<string, string>;
  setUrl: (key: string, url: string) => void;
  ensureToken: () => Promise<string | null>;
  onBusy: (delta: 1 | -1) => void;
  textPlaceholder?: string;
  autoFocus: boolean;
  canRemove: boolean;
  onText: (text: string) => void;
  onAddImage: (key: string) => void;
  onRemoveImage: (key: string) => void;
  onRemove: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  /** معاينة محلية لما رفعناه في هذه الجلسة (تظهر مضمونة حتى لو تأخر الرابط العام). */
  const [local, setLocal] = useState<Record<string, string>>({});
  /** مفتاح:مصدر ("l" محلي، "r" بعيد) تعذر عرضه، فنجرب الآخر ثم نعرض «رُفعت» بدل أيقونة مكسورة. */
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);
  const localRef = useRef(local);
  localRef.current = local;

  useEffect(() => {
    if (autoFocus) {
      textRef.current?.focus();
      textRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [autoFocus]);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  useEffect(
    () => () => {
      for (const u of Object.values(localRef.current)) URL.revokeObjectURL(u);
    },
    [],
  );

  const room = MAX_PRODUCT_IMAGES - product.images.length - pending.length;
  const hasContent = Boolean(product.text?.trim()) || product.images.length > 0 || pending.length > 0;

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setNotice(null);
    if (room <= 0) return void setNotice(`الحد الأقصى ${MAX_PRODUCT_IMAGES} صور للمنتج.`);
    const picked = Array.from(files)
      .filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name))
      .slice(0, room);
    if (!picked.length) return void setNotice("اختر صوراً (JPG أو PNG).");
    if (files.length > picked.length) setNotice(`أضفنا ${picked.length} صورة فقط (الحد ${MAX_PRODUCT_IMAGES} للمنتج).`);
    const token = await ensureToken();
    if (!token) return void setNotice("تعذّر تجهيز الرفع. تأكدوا من الاتصال بالإنترنت وأعيدوا المحاولة.");

    const fresh = picked.map((file) => ({ id: newId(), file, preview: URL.createObjectURL(file) }));
    setPending((p) => [...p, ...fresh.map((x) => ({ id: x.id, preview: x.preview }))]);
    onBusy(1);
    const errors: string[] = [];
    // ثلاث صور في وقت واحد: أسرع من التتابع ولا تخنق شبكة الموبايل.
    let next = 0;
    const worker = async () => {
      while (next < fresh.length) {
        const x = fresh[next++]!;
        try {
          const prepared = await prepareImage(x.file);
          const { key, url } = await uploadIntakeImage(token, prepared, "image");
          setUrl(key, url);
          // المعاينة من الملف بعد تحويله (HEIC يتحول إلى JPEG) فتُعرض في كل المتصفحات.
          setLocal((m) => ({ ...m, [key]: URL.createObjectURL(prepared) }));
          URL.revokeObjectURL(x.preview);
          onAddImage(key);
        } catch (e) {
          errors.push(uploadErrorMessage(e, ""));
          URL.revokeObjectURL(x.preview);
        } finally {
          setPending((p) => p.filter((y) => y.id !== x.id));
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, fresh.length) }, worker));
    onBusy(-1);
    if (errors.length) setNotice(`${errors.length === 1 ? "صورة واحدة" : `${errors.length} صور`} ما اترفعتش. ${errors.find(Boolean) || "تأكد من النت وجرّب ترفعها تاني."}`);
  };

  const src = (key: string): string | null => {
    if (local[key] && !broken.has(`l:${key}`)) return local[key]!;
    if (urls[key] && !broken.has(`r:${key}`)) return urls[key]!;
    return null;
  };
  const markBroken = (key: string) => setBroken((b) => new Set(b).add(local[key] && !b.has(`l:${key}`) ? `l:${key}` : `r:${key}`));

  return (
    <li className="space-y-3 rounded-2xl border border-edge/10 bg-edge/[0.03] p-3 sm:p-4" data-field>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={`product-${product.id}`} className="text-[14px] font-black text-ink">
          منتج {index + 1}
        </label>
        {canRemove ? (
          <button
            type="button"
            onClick={() => (hasContent && !armed ? setArmed(true) : onRemove())}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[13px] font-bold transition",
              armed ? "bg-rose-500/15 text-rose-300" : "text-ink-3 hover:text-rose-400",
            )}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {armed ? "اضغط تاني للحذف" : "حذف"}
          </button>
        ) : null}
      </div>

      <textarea
        ref={textRef}
        id={`product-${product.id}`}
        value={product.text ?? ""}
        maxLength={PRODUCT_TEXT_MAX}
        rows={3}
        onChange={(e) => onText(e.target.value)}
        placeholder={textPlaceholder ?? "اكتب أي كلام عن المنتج: اسمه، لونه، مقاسه، سعره، أي تفاصيل…"}
        aria-invalid={Boolean(error)}
        className={cn(textareaCls, "resize-y")}
      />
      <ErrorText>{error}</ErrorText>

      <div>
        <p className="mb-2 flex items-baseline gap-2 text-[13px] font-black text-ink-2">
          صور المنتج <span className="text-[12px] font-bold text-ink-3">(اختياري{product.images.length ? ` · ${product.images.length} من ${MAX_PRODUCT_IMAGES}` : ""})</span>
        </p>
        <ul className="flex flex-wrap gap-2">
          {product.images.map((key, n) => (
            <li key={key} className="relative size-[68px] overflow-hidden rounded-xl border border-edge/10 bg-edge/[0.06]">
              {src(key) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src(key)!} alt={`صورة ${n + 1} للمنتج ${index + 1}`} className="size-full object-cover" onError={() => markBroken(key)} />
              ) : (
                <span className="grid size-full place-items-center px-1 text-center text-[10px] font-bold leading-4 text-ink-3">
                  <AlertCircle className="mx-auto size-4" aria-hidden="true" />
                  رُفعت
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemoveImage(key)}
                aria-label={`حذف الصورة ${n + 1}`}
                className="absolute end-0.5 top-0.5 grid size-6 place-items-center rounded-full bg-black/65 text-white backdrop-blur-sm"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
          {pending.map((x) => (
            <li key={x.id} className="relative size-[68px] overflow-hidden rounded-xl border border-edge/10 bg-edge/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.preview} alt="" className="size-full object-cover opacity-50" />
              <span className="absolute inset-0 grid place-items-center">
                <Loader2 className="size-5 animate-spin text-white drop-shadow motion-reduce:animate-none" aria-label="بنرفع الصورة" />
              </span>
            </li>
          ))}
          {room > 0 ? (
            <li>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                aria-label="إضافة صور للمنتج"
                className="grid size-[68px] place-items-center rounded-xl border border-dashed border-nova/40 bg-nova/[0.06] text-nova-2 transition hover:bg-nova/[0.12]"
              >
                <ImagePlus className="size-6" aria-hidden="true" />
              </button>
            </li>
          ) : null}
        </ul>
        {notice ? (
          <p role="status" className="mt-2 text-[13px] font-bold leading-6 text-amber-300">
            {notice}
          </p>
        ) : null}
      </div>
      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => (void addFiles(e.target.files), (e.target.value = ""))} />
    </li>
  );
}
