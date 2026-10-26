// seo-llms.ts — /llms.txt و/llms-full.txt لمتجر (منطق خالص مختبَر): ملخص مقروء للآلة عن المتجر ليقتبسه المساعدون الأذكياء.
// الصيغة المعيارية (llmstxt.org): عنوان، ثم اقتباس بملخص، ثم أقسام بقوائم روابط. الكامل يضيف الإجابات ووصف المنتجات حرفياً.
// كل سطر من بيانات المتجر الفعلية (سياساته ومنتجاته المنشورة): لا أرقام ولا مزايا مخترعة.
import { clipText, plainText } from "./seo-meta";
import type { StoreAnswer } from "./seo-answers";

export type LlmsProduct = {
  name: string;
  url: string;
  priceLabel: string;
  /** سعر قبل الخصم إن وُجد خصم فعلي */
  wasLabel?: string;
  description?: string | null;
  category?: string;
  available: boolean;
};

export type LlmsInput = {
  site: { name: string; url: string; description?: string; language: string; country: string; currency: string };
  /** أسطر تواصل جاهزة («واتساب: …») */
  contact: string[];
  categories: { name: string; url: string; productCount: number }[];
  products: LlmsProduct[];
  answers: StoreAnswer[];
  pages: { title: string; url: string }[];
  links: { sitemap: string; feed?: string; full?: string };
};

/** أقواس الروابط في الأسماء تكسر صيغة ماركداون. */
const label = (s: string) => plainText(s).replace(/[[\]]/g, (c) => (c === "[" ? "(" : ")"));
const item = (name: string, url: string, note?: string) => `- [${label(name)}](${url})${note ? `: ${note}` : ""}`;

function productNote(p: LlmsProduct, withDescription: boolean): string {
  const price = p.wasLabel ? `${p.priceLabel} (بدلاً من ${p.wasLabel})` : p.priceLabel;
  const parts = [price, p.available ? "متوفر" : "غير متوفر حالياً", p.category ? `القسم: ${label(p.category)}` : null];
  const desc = withDescription ? clipText(p.description, 400) : "";
  return [parts.filter(Boolean).join(" · "), desc].filter(Boolean).join(" — ");
}

function head(input: LlmsInput): string[] {
  const { site } = input;
  const summary = clipText(site.description, 300) || `متجر ${site.name} الإلكتروني.`;
  return [
    `# ${site.name}`,
    "",
    `> ${summary}`,
    "",
    `الموقع: ${site.url}`,
    `اللغة: ${site.language} · الدولة: ${site.country} · العملة: ${site.currency}`,
    "",
  ];
}

/** /llms.txt: الفهرس المختصر (أقسام وأهم المنتجات وصفحات السياسات). */
export function renderLlmsTxt(input: LlmsInput, opts: { maxProducts?: number } = {}): string {
  const out = head(input);
  if (input.categories.length) {
    out.push("## الأقسام", ...input.categories.map((c) => item(c.name, c.url, `${c.productCount} منتج`)), "");
  }
  const products = input.products.slice(0, opts.maxProducts ?? 40);
  if (products.length) out.push("## أهم المنتجات", ...products.map((p) => item(p.name, p.url, productNote(p, false))), "");
  if (input.pages.length) out.push("## السياسات والمعلومات", ...input.pages.map((p) => item(p.title, p.url)), "");
  if (input.contact.length) out.push("## التواصل", ...input.contact.map((c) => `- ${c}`), "");
  const optional = [
    item("خريطة الموقع", input.links.sitemap),
    input.links.feed ? item("خلاصة المنتجات (RSS)", input.links.feed) : null,
    input.links.full ? item("النسخة الكاملة لهذا الملف", input.links.full) : null,
  ].filter((x): x is string => !!x);
  out.push("## Optional", ...optional, "");
  return out.join("\n");
}

/** /llms-full.txt: كل ما يلزم للإجابة عن أسئلة المشتري دون زيارة الصفحات (الإجابات، المنتجات بأوصافها). */
export function renderLlmsFull(input: LlmsInput): string {
  const out = head(input);
  if (input.answers.length) {
    out.push("## أسئلة وأجوبة", ...input.answers.flatMap((a) => [`### ${a.q}`, a.a, ""]));
  }
  if (input.categories.length) {
    out.push("## الأقسام", ...input.categories.map((c) => item(c.name, c.url, `${c.productCount} منتج`)), "");
  }
  if (input.products.length) out.push("## المنتجات", ...input.products.map((p) => item(p.name, p.url, productNote(p, true))), "");
  if (input.pages.length) out.push("## صفحات المتجر", ...input.pages.map((p) => item(p.title, p.url)), "");
  if (input.contact.length) out.push("## التواصل", ...input.contact.map((c) => `- ${c}`), "");
  out.push("## Optional", item("خريطة الموقع", input.links.sitemap), ...(input.links.feed ? [item("خلاصة المنتجات (RSS)", input.links.feed)] : []), "");
  return out.join("\n");
}
