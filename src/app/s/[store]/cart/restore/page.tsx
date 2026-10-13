// /cart/restore — «أكمل طلبك»: رابط موقّع يرسله التاجر لصاحب سلة متروكة (?c=السلة&t=رمز، و?promo= اختياري يلتقطه
// PromoFromLink). يعيد المنتجات بأسعارها ومخزونها الحاليين (لا بما كانت عليه)، ويتجاهل ما لم يعد متاحاً، ثم يفتح الدفع.
import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { requireStore } from "@/lib/tenant";
import { getTenantDb } from "@/db/tenant";
import { abandonedCarts, productVariants, products } from "@/db/schema";
import { validCartToken } from "@/lib/order-access";
import { CartRestore, type RestoreItem } from "@/components/storefront/CartRestore";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "إكمال الطلب", robots: { index: false, follow: false } };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const UUID = /^[0-9a-f-]{36}$/i;

export default async function RestorePage({ params, searchParams }: { params: Promise<{ store: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { store: sub } = await params;
  const sp = await searchParams;
  const store = await requireStore(sub);
  const id = one(sp.c);
  const token = one(sp.t).slice(0, 64);
  const db = await getTenantDb(store.id);
  const [cart] = UUID.test(id) ? await db.select().from(abandonedCarts).where(and(eq(abandonedCarts.id, id), eq(abandonedCarts.storeId, store.id))).limit(1) : [];

  if (!cart || !validCartToken(store.id, cart.id, token)) {
    return (
      <div className="container-x max-w-md py-16 text-center">
        <h1 className="text-2xl">الرابط غير صالح</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">المتجر مفتوح، والسلة تنتظر اختياراتك من جديد.</p>
        <Link href="/" className="btn-brand mt-6">
          العودة للمتجر
        </Link>
      </div>
    );
  }

  const productIds = [...new Set(cart.items.map((i) => i.productId))];
  const variantIds = cart.items.map((i) => i.variantId).filter((x): x is string => Boolean(x));
  const [prods, vars] = await Promise.all([
    productIds.length
      ? db.select().from(products).where(and(eq(products.storeId, store.id), inArray(products.id, productIds), eq(products.status, "active"), isNull(products.deletedAt)))
      : Promise.resolve([] as (typeof products.$inferSelect)[]),
    variantIds.length ? db.select().from(productVariants).where(and(eq(productVariants.storeId, store.id), inArray(productVariants.id, variantIds))) : Promise.resolve([] as (typeof productVariants.$inferSelect)[]),
  ]);

  const items: RestoreItem[] = [];
  for (const line of cart.items) {
    const p = prods.find((x) => x.id === line.productId);
    if (!p) continue;
    const v = line.variantId ? vars.find((x) => x.id === line.variantId && x.productId === p.id) : undefined;
    if (line.variantId && (!v || !v.isAvailable)) continue;
    const stock = v ? v.stock : p.stock;
    if (p.trackStock && stock !== null && stock <= 0) continue;
    items.push({
      productId: p.id,
      variantId: v?.id,
      slug: p.slug,
      name: p.name,
      imageUrl: v?.imageUrl ?? p.images[0]?.url,
      unitPiasters: v?.pricePiasters ?? p.pricePiasters,
      variantLabel: v?.optionValues.join(" / "),
      maxQty: p.trackStock ? stock : null,
      qty: Math.max(1, line.qty),
    });
  }

  return <CartRestore items={items} dropped={cart.items.length - items.length} customer={{ name: cart.name ?? undefined, phone: cart.phone ?? undefined }} />;
}
