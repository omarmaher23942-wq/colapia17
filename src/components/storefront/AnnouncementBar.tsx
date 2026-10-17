"use client";

// AnnouncementBar — شريط الإعلانات العام فوق الرأس: رسالة واحدة تظهر وتتبدل كل 5 ثوانٍ (تتوقف عند المرور أو التركيز
// أو تقليل الحركة)، الرسالة قابلة للنقر إن كان لها رابط، وللزائر إغلاقه فيُتذكر على جهازه حتى تتغير الرسائل.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { hrefFor } from "@/lib/links";
import type { StoreBlueprint } from "@/blueprint/schema";
import { useStore } from "./StoreProvider";

type Ann = NonNullable<StoreBlueprint["header"]["announcement"]>;

function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function AnnouncementBar({ ann }: { ann: Ann }) {
  const { storeId } = useStore();
  const items = ann.items.filter((i) => i.text.trim());
  const key = useMemo(() => `clp:ann:${storeId}:${hash(items.map((i) => i.text).join("|"))}`, [storeId, items]);
  const [hidden, setHidden] = useState(false);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    try {
      if (ann.dismissible && localStorage.getItem(key) === "1") setHidden(true);
    } catch {}
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, [key, ann.dismissible]);

  useEffect(() => {
    if (!ann.rotate || reduced || paused || items.length < 2 || hidden) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % items.length), 5000);
    return () => window.clearInterval(t);
  }, [ann.rotate, reduced, paused, items.length, hidden]);

  if (!ann.enabled || !items.length || hidden) return null;
  const cur = items[i % items.length]!;
  const text = <span className="truncate">{cur.text}</span>;

  return (
    <div
      className="relative flex min-h-10 items-center justify-center gap-2 px-10 text-[13px] font-bold"
      style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role="region"
      aria-label="إعلانات المتجر"
    >
      {items.length > 1 ? (
        <button type="button" onClick={() => setI((x) => (x - 1 + items.length) % items.length)} aria-label="الإعلان السابق" className="absolute end-10 grid size-9 place-items-center rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current">
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      ) : null}
      <p key={i} className="max-w-full animate-[clp-ann_0.35s_ease-out] motion-reduce:animate-none" aria-live="off">
        {cur.target ? (
          <Link href={hrefFor(cur.target)} className="inline-flex max-w-full items-center underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline">
            {text}
          </Link>
        ) : (
          text
        )}
      </p>
      {items.length > 1 ? (
        <button type="button" onClick={() => setI((x) => (x + 1) % items.length)} aria-label="الإعلان التالي" className="absolute end-1 grid size-9 place-items-center rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
      ) : null}
      {ann.dismissible ? (
        <button
          type="button"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(key, "1");
            } catch {}
          }}
          aria-label="إغلاق الإعلان"
          className="absolute start-1 grid size-9 place-items-center rounded-full hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
