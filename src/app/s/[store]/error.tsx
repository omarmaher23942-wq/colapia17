"use client";

// خطأ داخل المتجر: يبقى الرأس والتذييل وألوان المتجر ظاهرة (لا شاشة المنصة)، مع إعادة المحاولة والعودة للرئيسية.
import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[store/error]", error.message, error.digest);
  }, [error]);
  return (
    <div className="container-x py-16 text-center" role="alert">
      <h1 className="s-display text-2xl">حدث خلل مؤقت</h1>
      <p className="s-sub mx-auto mt-2 max-w-md">لم نتمكن من عرض هذه الصفحة الآن. سلتكم محفوظة، جرّبوا مرة أخرى أو عودوا للرئيسية.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="s-btn gap-2">
          <RotateCcw className="size-4" aria-hidden="true" /> إعادة المحاولة
        </button>
        <Link href="/" className="s-btn-ghost">
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
