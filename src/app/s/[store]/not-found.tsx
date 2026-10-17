import Link from "next/link";
import { Search } from "lucide-react";

/**
 * 404 بهوية المتجر: يُعرض داخل تخطيط المتجر (رأسه وتذييله وألوانه)، فلا يرى الزائر صفحة المنصة أبداً
 * عند منتج أو قسم أو صفحة غير موجودة.
 */
export default function StoreNotFound() {
  return (
    <div className="container-x grid min-h-[50vh] place-items-center py-16 text-center">
      <div className="w-full max-w-md">
        <p className="s-eyebrow">404</p>
        <h1 className="s-display mt-2 text-2xl">لم نجد هذه الصفحة</h1>
        <p className="s-sub mt-2">قد يكون الرابط قديماً أو المنتج لم يعد متاحاً. جرّبوا البحث أو العودة للرئيسية.</p>
        <form action="/search" className="mt-6 flex items-center rounded-full border bg-card px-4 py-3 shadow-card focus-within:ring-2 ring-primary/30">
          <Search className="size-5 text-muted-foreground" aria-hidden="true" />
          <input name="q" aria-label="البحث في المتجر" placeholder="ابحثوا عن منتج..." className="flex-1 bg-transparent px-3 outline-none" />
        </form>
        <Link href="/" className="s-btn mt-5 inline-flex">
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
