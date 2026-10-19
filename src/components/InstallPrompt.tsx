"use client";
// InstallPrompt — اقتراح تثبيت التطبيق (منصة أو متجر) وتسجيل الـ service worker.
// أندرويد/سطح المكتب: beforeinstallprompt. آيفون (سفاري): ورقة شرح «إضافة إلى الشاشة الرئيسية».
// يتذكر الإغلاق 14 يوماً، ولا يظهر للبوتات ولا للتطبيق المثبّت. المتجر: بعد ثاني صفحة أو الإضافة للسلة، وليس في الدفع.
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Share, SquarePlus, X } from "lucide-react";
import { isBotAgent, isDismissed, isIosSafari, storeShouldPrompt } from "@/lib/pwa";

type DeferredPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

type Props =
  | { variant: "platform"; disabled?: boolean }
  | { variant: "store"; storeId: string; storeName: string; logoUrl?: string | null; disabled?: boolean };

const safe = {
  get(k: string): string | null {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(k, v); } catch { /* التخزين غير متاح */ }
  },
};

export function InstallPrompt(props: Props) {
  const { variant, disabled } = props;
  const storeId = variant === "store" ? props.storeId : "platform";
  const dismissKey = `clp-install-dismissed:${storeId}`;
  const viewsKey = `clp-install-views:${storeId}`;
  const path = usePathname() ?? "/";
  const deferred = useRef<DeferredPrompt | null>(null);
  const [mode, setMode] = useState<"none" | "native" | "ios">("none");
  const [ready, setReady] = useState(false);
  const [added, setAdded] = useState(false);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);

  // تسجيل الـ service worker (لا يخزّن أي API أو دخول).
  useEffect(() => {
    if (disabled || !("serviceWorker" in navigator)) return;
    if (location.protocol !== "https:" && location.hostname !== "localhost" && !location.hostname.endsWith(".localhost")) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, [disabled]);

  // الأهلية: غير مثبّت، ليس بوتاً، لم يُغلق مؤخراً.
  useEffect(() => {
    if (disabled) return;
    const ua = navigator.userAgent;
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || isBotAgent(ua)) return;
    if (isDismissed(Number(safe.get(dismissKey)) || null, Date.now())) return;
    if (isIosSafari(ua)) setMode("ios");
    const onBip = (e: Event) => {
      e.preventDefault();
      deferred.current = e as DeferredPrompt;
      setMode("native");
    };
    const onInstalled = () => { setOpen(false); setMode("none"); safe.set(dismissKey, String(Date.now())); };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    setReady(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [disabled, dismissKey]);

  // المتجر: عدّاد صفحات المتسوق وحدث الإضافة للسلة.
  useEffect(() => {
    if (disabled || variant !== "store") return;
    const n = (Number(safe.get(viewsKey)) || 0) + 1;
    safe.set(viewsKey, String(n));
  }, [path, disabled, variant, viewsKey]);
  useEffect(() => {
    if (variant !== "store") return;
    const onAdd = () => setAdded(true);
    window.addEventListener("clp:cart-add", onAdd);
    return () => window.removeEventListener("clp:cart-add", onAdd);
  }, [variant]);

  const eligible =
    ready && mode !== "none" && !disabled &&
    (variant === "platform" || storeShouldPrompt({ pageViews: Number(safe.get(viewsKey)) || 0, addedToCart: added, path }));

  useEffect(() => { setOpen(eligible); }, [eligible]);

  const dismiss = useCallback(() => {
    safe.set(dismissKey, String(Date.now()));
    setOpen(false);
    setSheet(false);
  }, [dismissKey]);

  const install = useCallback(async () => {
    if (mode === "ios") { setSheet(true); return; }
    const d = deferred.current;
    if (!d) return;
    await d.prompt();
    const choice = await d.userChoice.catch(() => null);
    deferred.current = null;
    if (choice?.outcome === "accepted") setOpen(false);
    else dismiss();
  }, [mode, dismiss]);

  if (!open) return null;
  const isStore = variant === "store";
  const name = isStore ? props.storeName : "كولابيا";
  const line = isStore
    ? `ثبّتوا تطبيق ${name} للوصول السريع وتتبع الطلبات`
    : "ثبّتوا كولابيا على جهازكم للوصول السريع إلى لوحة المتجر";

  return (
    <>
      <div
        role="region"
        aria-label="تثبيت التطبيق"
        className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border p-3 shadow-xl md:bottom-4 md:start-4 md:end-auto md:mx-0"
        style={{
          background: isStore ? "var(--background, #fff)" : "var(--dash-surface, #fff)",
          color: isStore ? "var(--foreground, #111827)" : "var(--dash-ink, #111827)",
          borderColor: "color-mix(in srgb, currentColor 18%, transparent)",
        }}
      >
        {isStore && props.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={props.logoUrl} alt="" width={40} height={40} className="size-10 shrink-0 rounded-xl object-cover" />
        ) : (
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-neutral-900 text-base font-extrabold text-white">
            {Array.from(name)[0]}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold leading-snug">{line}</p>
        </div>
        <button
          type="button"
          onClick={install}
          className="min-h-11 shrink-0 rounded-xl bg-neutral-900 px-4 text-[13px] font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:bg-white dark:text-neutral-900"
        >
          تثبيت
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="إغلاق الاقتراح"
          className="grid size-11 shrink-0 place-items-center rounded-xl opacity-70 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-current"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {sheet ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50" onClick={() => setSheet(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="طريقة تثبيت التطبيق"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-neutral-900 shadow-2xl"
          >
            <h2 className="mb-3 text-base font-extrabold">تثبيت {name} على الآيفون</h2>
            <ol className="space-y-3 text-sm leading-relaxed">
              <li className="flex items-start gap-3"><Share className="mt-0.5 size-5 shrink-0" aria-hidden /><span>اضغطوا زر المشاركة في أسفل سفاري.</span></li>
              <li className="flex items-start gap-3"><SquarePlus className="mt-0.5 size-5 shrink-0" aria-hidden /><span>اختاروا «إضافة إلى الشاشة الرئيسية».</span></li>
              <li className="flex items-start gap-3"><span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center text-xs font-extrabold">٣</span><span>اضغطوا «إضافة» وسيظهر التطبيق بين تطبيقاتكم.</span></li>
            </ol>
            <button
              type="button"
              onClick={dismiss}
              className="mt-5 min-h-11 w-full rounded-xl bg-neutral-900 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
            >
              فهمت
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
