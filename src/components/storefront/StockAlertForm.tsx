"use client";

// StockAlertForm — «نبّهني عند التوفر» تحت أزرار الشراء حين ينفد المنتج أو الاختيار المحدد: رقم واحد، والمتجر يراسله
// على واتساب حين يعود. الرقم المكتوب يُتذكر على هذا الجهاز لهذا المتجر.
import { useEffect, useState, useTransition } from "react";
import { BellRing, Check, Loader2 } from "lucide-react";
import { requestStockAlertAction } from "@/server/actions/stock-alerts";

export function StockAlertForm({ subdomain, productId, variantId, label }: { subdomain: string; productId: string; variantId?: string; label?: string }) {
  const key = `clp:alert-phone:${subdomain}`;
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    try {
      setPhone(localStorage.getItem(key) ?? "");
    } catch {}
  }, [key]);
  useEffect(() => setDone(null), [variantId]);

  if (done === (variantId ?? "")) {
    return (
      <p className="flex items-center gap-2 rounded-2xl p-3 text-sm font-bold" style={{ background: "color-mix(in oklab, var(--primary) 10%, transparent)" }} role="status">
        <Check className="size-4 shrink-0" aria-hidden="true" /> تمام، هنبلغك على واتساب أول ما {label ? `«${label}»` : "المنتج"} يتوفر.
      </p>
    );
  }
  return (
    <form
      className="space-y-2 rounded-2xl border p-3"
      style={{ borderColor: "var(--border)" }}
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        start(async () => {
          const r = await requestStockAlertAction({ subdomain, productId, variantId, phone });
          if (!r.ok) return void setErr(r.error);
          try {
            localStorage.setItem(key, phone);
          } catch {}
          setDone(variantId ?? "");
        });
      }}
    >
      <p className="flex items-center gap-2 text-sm font-black">
        <BellRing className="size-4" style={{ color: "var(--primary)" }} aria-hidden="true" /> نبلغك أول ما {label ? `«${label}»` : "المنتج"} يتوفر
      </p>
      <div className="flex gap-2">
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          dir="ltr"
          maxLength={20}
          required
          placeholder="رقم الموبايل (واتساب)"
          aria-label="رقم الموبايل للتنبيه"
          className="s-input h-11 min-w-0 flex-1 rounded-xl border px-3 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--background)" }}
        />
        <button type="submit" disabled={pending} className="s-btn h-11 shrink-0 px-4 text-sm">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : "نبّهني"}
        </button>
      </div>
      {err ? <p role="alert" className="text-xs font-bold text-[var(--danger)]">{err}</p> : null}
    </form>
  );
}
