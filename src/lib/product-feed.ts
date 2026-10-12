// product-feed.ts — خلاصة منتجات المتجر بصيغة RSS 2.0 بمفردات Google Merchant (g:)، وهي الصيغة نفسها التي يقبلها
// «كتالوج» مدير التجارة في ميتا لإعلانات المنتجات الديناميكية. منطق خالص مختبَر: يأخذ المنتجات المنشورة ويكتب XML آمناً.
export type FeedProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  pricePiasters: number;
  compareAtPiasters: number | null;
  images: { url: string }[];
  /** null = متاح دائماً (لا تتبع مخزون). */
  stock: number | null;
  trackStock: boolean;
  category: string | null;
  sku: string | null;
};

const esc = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const price = (p: number) => `${(p / 100).toFixed(2)} EGP`;
const plain = (s: string | null) => (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export function feedAvailable(p: Pick<FeedProduct, "stock" | "trackStock">): boolean {
  return !p.trackStock || p.stock === null || p.stock > 0;
}

/** منتج بلا صورة برابط عام (http/https) لا يُدرج: المنصتان ترفضانه. */
export function renderProductFeed(opts: { storeName: string; storeUrl: string; description?: string | null; products: FeedProduct[] }): string {
  const base = opts.storeUrl.replace(/\/$/, "");
  const items = opts.products
    .map((p) => ({ ...p, images: p.images.filter((i) => /^https?:\/\//i.test(i.url)) }))
    .filter((p) => p.images.length > 0 && p.pricePiasters > 0)
    .map((p) => {
      const onSale = p.compareAtPiasters && p.compareAtPiasters > p.pricePiasters;
      const desc = plain(p.description).slice(0, 4900) || p.name;
      return [
        "<item>",
        `<g:id>${esc(p.sku || p.id)}</g:id>`,
        `<g:title>${esc(p.name.slice(0, 150))}</g:title>`,
        `<g:description>${esc(desc)}</g:description>`,
        `<g:link>${esc(`${base}/p/${encodeURIComponent(p.slug)}`)}</g:link>`,
        `<g:image_link>${esc(p.images[0]!.url)}</g:image_link>`,
        ...p.images.slice(1, 10).map((i) => `<g:additional_image_link>${esc(i.url)}</g:additional_image_link>`),
        `<g:availability>${feedAvailable(p) ? "in_stock" : "out_of_stock"}</g:availability>`,
        `<g:price>${price(onSale ? p.compareAtPiasters! : p.pricePiasters)}</g:price>`,
        onSale ? `<g:sale_price>${price(p.pricePiasters)}</g:sale_price>` : "",
        `<g:condition>new</g:condition>`,
        `<g:brand>${esc(opts.storeName.slice(0, 70))}</g:brand>`,
        `<g:identifier_exists>no</g:identifier_exists>`,
        p.category ? `<g:product_type>${esc(p.category.slice(0, 750))}</g:product_type>` : "",
        "</item>",
      ]
        .filter(Boolean)
        .join("");
    });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "<channel>",
    `<title>${esc(opts.storeName)}</title>`,
    `<link>${esc(base)}</link>`,
    `<description>${esc(plain(opts.description ?? "") || opts.storeName)}</description>`,
    ...items,
    "</channel>",
    "</rss>",
  ].join("\n");
}
