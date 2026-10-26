"use client";

// StoreChrome — طبقة راحة تشمل كل صفحات المتجر:
// - شريط تقدم رفيع أعلى الصفحة عند التنقل بين الصفحات.
// - تنبيه فقدان الاتصال (السلة محفوظة على الجهاز) وتنبيه عودته.
// - زر «العودة للأعلى» بعد النزول، يرتفع فوق الشريط السفلي وزر واتساب.
// - إشعارات حالة الطلبات: عند عودة الزائر يُخبَر بما تغيّر في طلباته منذ آخر زيارة.
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { statusChanges } from "@/lib/shopper-ui";
import { useStore } from "./StoreProvider";

export function StoreChrome() {
  const pathname = usePathname();
  const { storeId } = useStore();
  const [online, setOnline] = useState(true);
  const [back, setBack] = useState(false);
  const [busy, setBusy] = useState(false);
  const first = useRef(true);

  // شريط التقدم: يبدأ عند نقر رابط داخلي ويكتمل عند تغيّر المسار.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("//") || href === window.location.pathname + window.location.search) return;
      setBusy(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  useEffect(() => {
    setBusy(false);
  }, [pathname]);
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setBusy(false), 8000);
    return () => clearTimeout(t);
  }, [busy]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      if (!first.current) toast.success("عاد الاتصال");
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    first.current = false;
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setBack(window.scrollY > window.innerHeight * 1.5);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // إشعارات حالة الطلبات: مرة عند الفتح ثم كل دقيقتين والصفحة ظاهرة.
  useEffect(() => {
    const key = `clp-order-seen:${storeId}`;
    let alive = true;
    const check = async () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      try {
        const r = await fetch("/api/storefront/my-orders", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { orders?: { code: string; status: string }[] };
        if (!alive || !j.orders) return;
        let seen: Record<string, string> = {};
        try {
          seen = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, string>;
        } catch {
          seen = {};
        }
        const changed = statusChanges(seen, j.orders);
        const next: Record<string, string> = {};
        for (const o of j.orders) next[o.code] = o.status;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* no-op */
        }
        for (const c of changed.slice(0, 3)) {
          toast(`${c.text}`, { description: `الطلب ${c.code}`, action: { label: "عرض", onClick: () => window.location.assign(`/track?code=${encodeURIComponent(c.code)}`) }, duration: 9000 });
        }
      } catch {
        /* no-op */
      }
    };
    void check();
    const iv = window.setInterval(check, 120_000);
    return () => {
      alive = false;
      window.clearInterval(iv);
    };
  }, [storeId]);

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-0.5 overflow-hidden" style={{ opacity: busy ? 1 : 0, transition: "opacity .2s" }}>
        <div className={busy ? "clp-progress-bar h-full w-1/3" : "h-full w-0"} style={{ background: "var(--primary)" }} />
      </div>
      <style>{`@keyframes clp-progress{0%{transform:translateX(120%)}100%{transform:translateX(-320%)}}.clp-progress-bar{animation:clp-progress 1.1s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.clp-progress-bar{animation:none;width:100%;opacity:.6}}`}</style>
      {!online ? (
        <p role="status" className="fixed inset-x-3 top-3 z-[75] mx-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold shadow-xl" style={{ background: "var(--foreground)", color: "var(--background)" }}>
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          لا يوجد اتصال بالإنترنت. سلتكم محفوظة وتعود المتابعة فور رجوعه.
        </p>
      ) : null}
      {back ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
          aria-label="العودة إلى أعلى الصفحة"
          style={{ bottom: "calc(5.75rem + var(--clp-bottom-offset, 0px))", background: "var(--card)", color: "var(--foreground)", borderColor: "var(--border)" }}
          className="fixed start-4 z-40 grid size-11 place-items-center rounded-full border shadow-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2"
        >
          <ArrowUp className="size-5" strokeWidth={1.75} aria-hidden="true" />
        </button>
      ) : null}
    </>
  );
}
