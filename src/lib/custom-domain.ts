// custom-domain.ts — النطاق الخاص للمتجر (المرحلة 7): تطبيع ما يكتبه التاجر وسجلات DNS المطلوبة وتقييم حالة الربط
// من نتيجة فحص DNS. منطق خالص مختبَر (يستورده الخادم والواجهة ومسار الوسيط).
//
// الوجهة تتبع مكان الاستضافة (DomainTarget، يختارها server/domains.ts):
// - Cloudflare (Cloudflare for SaaS): كل نطاق بسجل CNAME إلى «نطاق الاستقبال» (customers.colapia.com افتراضياً).
//   الجذري (example.com) يحتاج CNAME على @ (يسميه بعض المزودين ALIAS أو ANAME)؛ مزود لا يدعمه = نقل DNS النطاق إلى
//   Cloudflare مجاناً أو استخدام نطاق فرعي مثل shop.example.com.
// - Vercel: الجذري بسجل A إلى 76.76.21.21، والفرعي بسجل CNAME إلى cname.vercel-dns.com.
export const VERCEL_A = "76.76.21.21";
export const VERCEL_CNAME = "cname.vercel-dns.com";

export type DomainTarget = { kind: "vercel" } | { kind: "cloudflare"; cname: string };
export const VERCEL_TARGET: DomainTarget = { kind: "vercel" };

export const DOMAIN_STATUSES = ["pending", "awaiting_team", "active"] as const;
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const BLOCKED = /(^|\.)(colapia\.com|vercel\.app|vercel\.com|workers\.dev|pages\.dev|r2\.dev|localhost|local|internal)$/;

/** «https://www.Shop.com/path» ← «shop.com». null إن لم يكن نطاقاً عاماً صالحاً أو كان من نطاقاتنا. */
export function normalizeDomain(raw: string, rootDomain = "colapia.com"): string | null {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0]!.replace(/\.$/, "");
  // «www.mystore.com» = النطاق الجذري نفسه (نربط الجذري وwww معاً).
  if (s.startsWith("www.") && s.split(".").length > 2) s = s.slice(4);
  if (s.includes(":") || s.includes("@")) return null;
  if (!s || s.length > 253) return null;
  const labels = s.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return null;
  const tld = labels[labels.length - 1]!;
  if (!/^[a-z]{2,}$/.test(tld) && !/^xn--[a-z0-9-]+$/.test(tld)) return null;
  if (BLOCKED.test(s) || s === rootDomain || s.endsWith(`.${rootDomain}`)) return null;
  return s;
}

/** جذري (example.com أو example.com.eg) أم فرعي (www.example.com). تقدير بسيط لامتدادات مصر والشائعة. */
export function isApex(domain: string): boolean {
  const parts = domain.split(".");
  const twoLevel = /^(com|net|org|gov|edu|co)\.[a-z]{2}$/.test(parts.slice(-2).join("."));
  return parts.length === (twoLevel ? 3 : 2);
}

export type DnsRecord = { type: "A" | "CNAME"; name: string; value: string };

/** السجلات التي يضيفها التاجر عند مسجّل نطاقه. */
export function dnsRecordsFor(domain: string, target: DomainTarget = VERCEL_TARGET): DnsRecord[] {
  const cname = target.kind === "cloudflare" ? target.cname : VERCEL_CNAME;
  if (isApex(domain)) return [target.kind === "cloudflare" ? { type: "CNAME", name: "@", value: cname } : { type: "A", name: "@", value: VERCEL_A }, { type: "CNAME", name: "www", value: cname }];
  // اسم السجل = كل ما قبل النطاق الجذري (shop في shop.example.com، وa.b في a.b.example.com).
  const labels = domain.split(".");
  const apexLen = /^(com|net|org|gov|edu|co)\.[a-z]{2}$/.test(labels.slice(-2).join(".")) ? 3 : 2;
  return [{ type: "CNAME", name: labels.slice(0, labels.length - apexLen).join("."), value: cname }];
}

export type DnsLookup = { a: string[]; cname: string[] };

const bare = (h: string) => h.toLowerCase().replace(/\.$/, "");

/**
 * هل يشير النطاق إلينا الآن؟ Vercel: A إلى عنوانه أو CNAME إلى vercel-dns. Cloudflare: CNAME إلى نطاق الاستقبال (الجذري
 * المسطّح يظهر عناوين A فقط، فيُحسم من حالة النطاق في Cloudflare نفسها: server/domains.ts).
 */
export function dnsPointsToUs(r: DnsLookup, target: DomainTarget = VERCEL_TARGET): boolean {
  if (target.kind === "cloudflare") return r.cname.some((c) => bare(c) === bare(target.cname));
  return r.a.includes(VERCEL_A) || r.cname.some((c) => /(^|\.)vercel-dns(-\d+)?\.com$/.test(bare(c)));
}

/** شرح عربي لحالة الربط من نتيجة الفحص. */
export function explainDns(domain: string, r: DnsLookup | null, target: DomainTarget = VERCEL_TARGET): string {
  if (!r) return "تعذر فحص النطاق الآن. جرّب بعد دقائق.";
  if (dnsPointsToUs(r, target)) return "النطاق يشير لمتجرك. الشهادة الآمنة (https) تُصدر تلقائياً خلال دقائق.";
  if (!r.a.length && !r.cname.length) return `لا سجلات للنطاق ${domain} بعد. أضف السجلات أدناه عند الشركة التي اشتريت منها النطاق (قد يأخذ التحديث حتى 48 ساعة، وغالباً دقائق).`;
  return `النطاق يشير لمكان آخر الآن (${[...r.a, ...r.cname].slice(0, 3).join("، ")}). عدّل السجلات لتطابق ما أدناه واحذف القديمة المتعارضة.`;
}
