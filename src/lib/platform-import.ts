// platform-import.ts — استيراد ملفات التصدير من المنصات الأخرى (Shopify وWooCommerce وسلة وزد) إلى مرشّحين (خالص ومختبَر).
// يكتشف المنصة من عناوين الأعمدة، وينظّف وصف HTML، ويجمّع صفوف التركيبات في منتج واحد بمقاساته وألوانه.
import { newId, normalizeCandidate, normalizeColor, normalizeSize, type Candidate } from "@/lib/import-candidates";
import { parseNumber } from "@/lib/product-import";

const toNumber = (s: string): number | null => {
  const v = parseNumber(s);
  return v === null || Number.isNaN(v) ? null : v;
};

export type SourcePlatform = "shopify" | "woocommerce" | "salla" | "zid";
export const PLATFORM_LABEL: Record<SourcePlatform, string> = { shopify: "Shopify", woocommerce: "WooCommerce", salla: "سلة", zid: "زد" };

const n = (s: string) => s.toLowerCase().replace(/[\s_\-:()]+/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

/** يحوّل HTML الوصف إلى نص عادي بأسطر، بلا وسوم ولا كيانات. */
export function stripHtml(html: string): string {
  return String(html ?? "")
    .replace(/<\s*(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export function detectPlatform(header: string[]): SourcePlatform | null {
  const h = new Set(header.map(n));
  if (h.has("handle") && h.has("title") && (h.has("variantprice") || h.has("option1value"))) return "shopify";
  if ((h.has("regularprice") || h.has("saleprice")) && (h.has("name") || h.has("sku")) && (h.has("categories") || h.has("images") || h.has("type"))) return "woocommerce";
  if (h.has("اسمالمنتج") && (h.has("سعرالمنتج") || h.has("السعر")) && (h.has("sku") || h.has("رمزالمنتجsku") || h.has("تصنيفالمنتج") || h.has("الوزن"))) return "salla";
  if ((h.has("اسمالمنتجar") || h.has("productnamear") || h.has("اسمالمنتجعربي")) || (h.has("اسمالمنتج") && h.has("السعرقبلالخصم"))) return "zid";
  return null;
}

type Row = Record<string, string>;
const toRows = (table: string[][]): Row[] => {
  const [head, ...body] = table.filter((r) => r.some((c) => String(c ?? "").trim()));
  if (!head) return [];
  const keys = head.map((h) => n(String(h ?? "")));
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, String(r[i] ?? "").trim()])));
};
const pick = (r: Row, ...names: string[]) => {
  for (const x of names) {
    const v = r[n(x)];
    if (v) return v;
  }
  return "";
};
const imgs = (s: string) => s.split(/[,|\s]+/).filter((u) => /^https:\/\//i.test(u)).slice(0, 10);
const list = (s: string) => s.split(/[،,/|;؛]+/).map((x) => x.trim()).filter(Boolean);

function finish(c: Partial<Candidate>): Candidate | null {
  return normalizeCandidate({ ...c, source: "file" });
}

function shopify(rows: Row[]): Candidate[] {
  const byHandle = new Map<string, Candidate>();
  for (const r of rows) {
    const handle = pick(r, "Handle");
    if (!handle) continue;
    let c = byHandle.get(handle);
    if (!c) {
      const title = pick(r, "Title");
      if (!title) continue;
      const built = finish({
        name: title,
        description: stripHtml(pick(r, "Body (HTML)")),
        category: pick(r, "Type", "Product Category").split(">").pop()?.trim() ?? "",
        images: imgs(pick(r, "Image Src")),
      });
      if (!built) continue;
      c = built;
      byHandle.set(handle, c);
    }
    const price = toNumber(pick(r, "Variant Price"));
    if (price && (c.price === null || price < c.price)) c.price = price;
    const cmp = toNumber(pick(r, "Variant Compare At Price"));
    if (cmp && c.price !== null && cmp > c.price) c.compareAt = cmp;
    const qty = toNumber(pick(r, "Variant Inventory Qty"));
    if (qty !== null && qty >= 0) c.stock = (c.stock ?? 0) + Math.floor(qty);
    for (let k = 1; k <= 3; k++) {
      const name = n(pick(r, `Option${k} Name`));
      const val = pick(r, `Option${k} Value`);
      if (!val || val === "Default Title") continue;
      if (/size|مقاس|قياس/.test(name)) {
        const s = normalizeSize(val);
        if (s && !c.sizes.includes(s)) c.sizes.push(s);
      } else if (/color|colour|لون/.test(name)) {
        const col = normalizeColor(val);
        if (col && !c.colors.includes(col)) c.colors.push(col);
      }
    }
    for (const u of imgs(pick(r, "Image Src"))) if (c.images.length < 10 && !c.images.includes(u)) c.images.push(u);
  }
  return [...byHandle.values()];
}

function woo(rows: Row[]): Candidate[] {
  const out: Candidate[] = [];
  for (const r of rows) {
    if (/^variation$/i.test(pick(r, "Type"))) continue;
    const regular = toNumber(pick(r, "Regular price"));
    const sale = toNumber(pick(r, "Sale price"));
    const price = sale && regular && sale < regular ? sale : regular ?? sale;
    const sizes: string[] = [];
    const colors: string[] = [];
    for (let k = 1; k <= 3; k++) {
      const name = n(pick(r, `Attribute ${k} name`));
      const vals = list(pick(r, `Attribute ${k} value(s)`, `Attribute ${k} values`));
      if (/size|مقاس|قياس/.test(name)) sizes.push(...vals.map(normalizeSize).filter((x): x is string => Boolean(x)));
      else if (/color|colour|لون/.test(name)) colors.push(...vals.map(normalizeColor).filter((x): x is string => Boolean(x)));
    }
    const stock = toNumber(pick(r, "Stock"));
    const c = finish({
      name: pick(r, "Name"),
      price,
      compareAt: sale && regular && sale < regular ? regular : null,
      description: stripHtml(pick(r, "Short description") || pick(r, "Description")),
      category: (pick(r, "Categories").split(",")[0] ?? "").split(">").pop()?.trim() ?? "",
      images: imgs(pick(r, "Images")),
      sizes,
      colors,
      stock: stock !== null && stock >= 0 ? Math.floor(stock) : null,
    });
    if (c) out.push(c);
  }
  return out;
}

function arabicStores(rows: Row[]): Candidate[] {
  const out: Candidate[] = [];
  for (const r of rows) {
    const price = toNumber(pick(r, "سعر المنتج", "السعر"));
    const sale = toNumber(pick(r, "السعر المخفض", "سعر التخفيض", "سعر الخصم"));
    const before = toNumber(pick(r, "السعر قبل الخصم"));
    const base = sale && price && sale < price ? sale : price;
    const compare = sale && price && sale < price ? price : before;
    const stock = toNumber(pick(r, "الكمية", "المخزون"));
    const c = finish({
      name: pick(r, "اسم المنتج", "اسم المنتج AR", "Product Name AR"),
      price: base,
      compareAt: compare,
      description: stripHtml(pick(r, "وصف المنتج", "الوصف")),
      category: pick(r, "تصنيف المنتج", "التصنيف", "القسم").split(/[>،,]/)[0]?.trim() ?? "",
      images: imgs(pick(r, "صورة المنتج", "روابط الصور", "الصور", "رابط الصورة")),
      stock: stock !== null && stock >= 0 ? Math.floor(stock) : null,
    });
    if (c) out.push(c);
  }
  return out;
}

/** جدول تصدير منصة معروفة ← مرشّحون، أو null إن لم تُعرف المنصة. */
export function candidatesFromPlatform(table: string[][]): { platform: SourcePlatform; candidates: Candidate[] } | null {
  const head = table.find((r) => r.some((c) => String(c ?? "").trim()));
  if (!head) return null;
  const platform = detectPlatform(head.map((c) => String(c ?? "")));
  if (!platform) return null;
  const rows = toRows(table);
  const candidates = platform === "shopify" ? shopify(rows) : platform === "woocommerce" ? woo(rows) : arabicStores(rows);
  return { platform, candidates: candidates.map((c) => ({ ...c, id: c.id || newId() })) };
}
