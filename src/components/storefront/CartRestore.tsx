"use client";

// CartRestore — يضع منتجات السلة المسترجعة في سلة العميل (مكان ما فيها) ثم يفتح صفحة الدفع.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { itemKey, useCart, useCartApi } from "@/store/cart";

export type RestoreItem = {
  productId: string;
  variantId?: string;
  slug: string;
  name: string;
  imageUrl?: string;
  unitPiasters: number;
  variantLabel?: string;
  maxQty: number | null;
  qty: number;
};

export function CartRestore({ items, dropped, customer }: { items: RestoreItem[]; dropped: number; customer: { name?: string; phone?: string } }) {
  const router = useRouter();
  const add = useCart((s) => s.add);
  const cartApi = useCartApi();
  const close = useCart((s) => s.close);
  const saved = useCart((s) => s.customer);
  const remember = useCart((s) => s.rememberCustomer);
  const done = useRef(false);
  const [empty] = useState(items.length === 0);

  useEffect(() => {
    if (done.current || empty) return;
    done.current = true;
    // دمج لا استبدال: ما اختاره العميل بعد ترك السلة يبقى، وما كان فيها يُضاف إن لم يكن موجوداً.
    const existing = new Set(cartApi.getState().items.map(itemKey));
    for (const { qty, ...item } of items) if (!existing.has(itemKey(item))) add(item, qty);
    // الاسم والموبايل اللذان كتبهما في المرة الأولى، ما لم تكن له بيانات محفوظة على هذا الجهاز.
    if (!saved?.phone && customer.phone) remember({ ...saved, name: customer.name, phone: customer.phone });
    close();
    const t = setTimeout(() => router.replace(dropped ? "/cart" : "/checkout"), dropped ? 0 : 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, dropped, empty]);

  if (empty)
    return (
      <div className="container-x max-w-md py-16 text-center">
        <h1 className="text-2xl">منتجات السلة لم تعد متاحة</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">نفدت أو لم تعد معروضة، وفي المتجر منتجات جديدة كثيرة.</p>
        <Link href="/" className="btn-brand mt-6">
          العودة للمتجر
        </Link>
      </div>
    );

  return (
    <div className="container-x flex max-w-md flex-col items-center py-20 text-center">
      <Loader2 className="size-8 animate-spin text-[var(--brand)]" aria-hidden="true" />
      <p className="mt-4 text-lg font-bold">نجهّز الطلب...</p>
      <p className="mt-1 text-sm text-muted-foreground">أعدنا المنتجات إلى السلة بأسعارها الحالية.</p>
    </div>
  );
}
