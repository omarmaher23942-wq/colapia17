// launch-copy.ts — نصوص عُدّة الإطلاق (إعلانات ميتا، بث واتساب، سطر البايو، تعليق المنشور) مبنية من بيانات المتجر
// وحقائقه الصحيحة فقط (السياسات والشحن والدفع كما هي في متجره)، بلا أرقام أو ادعاءات مخترعة. منطق خالص مختبَر.
import { formatEgp } from "@/lib/money";

export type LaunchProduct = { name: string; pricePiasters: number; compareAtPiasters: number | null };
export type LaunchInput = {
  storeName: string;
  tagline?: string | null;
  url: string;
  /** عناوين حقائق المتجر الصحيحة (blueprint/facts)، مثل «الدفع عند الاستلام». */
  facts: string[];
  product?: LaunchProduct | null;
  code?: { code: string; label: string } | null;
};

export type LaunchCopy = { key: string; title: string; text: string }[];

const priceLine = (p: LaunchProduct) =>
  p.compareAtPiasters && p.compareAtPiasters > p.pricePiasters
    ? `بـ ${formatEgp(p.pricePiasters)} بدل ${formatEgp(p.compareAtPiasters)}`
    : `بـ ${formatEgp(p.pricePiasters)}`;

export function launchCopy(i: LaunchInput): LaunchCopy {
  const facts = i.facts.slice(0, 4);
  const ticks = facts.map((f) => `✓ ${f}`).join("\n");
  const deal = i.code ? `\n🎁 ${i.code.label} بالكود ${i.code.code}` : "";
  const intro = i.tagline?.trim() ? `${i.storeName} | ${i.tagline.trim()}` : i.storeName;
  const prod = i.product ? `${i.product.name} ${priceLine(i.product)}` : null;

  const out: LaunchCopy = [];
  out.push({
    key: "ad_short",
    title: "نص إعلان قصير",
    text: [prod ? `${prod} 🛍️` : `${i.storeName} صار أونلاين 🛍️`, facts.length ? facts.slice(0, 2).join(" · ") : null, `اطلب الآن: ${i.url}`].filter(Boolean).join("\n") + deal,
  });
  out.push({
    key: "ad_long",
    title: "نص إعلان مفصّل",
    text: [intro, "", prod ? `✨ ${prod}` : "✨ تشكيلتنا كاملة على موقعنا", ticks || null, deal.trim() || null, "", `اطلب من هنا في دقيقة 👇`, i.url].filter((x) => x !== null).join("\n"),
  });
  out.push({
    key: "headlines",
    title: "عناوين قصيرة للإعلان",
    text: [prod ? i.product!.name : i.storeName, facts[0] ?? "اطلب أونلاين بسهولة", i.code ? `${i.code.label} لفترة محدودة` : `تسوّق ${i.storeName}`].map((h) => h.slice(0, 40)).join("\n"),
  });
  out.push({
    key: "whatsapp",
    title: "رسالة بث واتساب لعملائك",
    text: [`أهلاً 👋 معك ${i.storeName}.`, `متجرنا صار أونلاين، تقدر تشوف كل المنتجات وتطلب في دقيقة:`, i.url, ticks || null, deal.trim() || null, "ولو عندك أي سؤال رد علينا هنا."].filter(Boolean).join("\n"),
  });
  out.push({ key: "bio", title: "سطر البايو (إنستجرام وتيك توك)", text: `${i.tagline?.trim() || i.storeName}${facts[0] ? ` · ${facts[0]}` : ""}\n🛒 اطلب من هنا 👇\n${i.url}` });
  out.push({
    key: "caption",
    title: "تعليق منشور الإطلاق",
    text: [`🎉 ${i.storeName} صار عنده متجر أونلاين!`, prod ? `ابدأ بـ ${prod}` : null, ticks || null, deal.trim() || null, `الرابط في البايو أو هنا: ${i.url}`].filter(Boolean).join("\n"),
  });
  return out;
}
