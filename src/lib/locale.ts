// locale.ts — طبقة السوق: العملة واللغة والمنطقة الزمنية وصيغ الهاتف والعنوان من إعداد واحد.
// السوق الافتراضي مصر؛ إضافة سوق أو تغييره = إعداد في MARKETS ومتغير NEXT_PUBLIC_MARKET، لا تعديل كود في الصيغ.
export type PhoneRule = {
  /** مفتاح الدولة الدولي بلا + (مثل 20). */
  dial: string;
  /** الرقم المحلي بصيغته القياسية (مع الصفر الأول إن وُجد). */
  local: RegExp;
  /** الصفر الذي يسبق الرقم محلياً ويُحذف عند التحويل الدولي. */
  trunk: string;
  /** تجميع العرض المقروء: أطوال المقاطع. */
  groups: number[];
};

export type Market = {
  code: string;
  locale: string;
  timezone: string;
  currency: { code: string; symbol: string; minorUnit: number };
  phone: PhoneRule;
  /** ترتيب حقول العنوان كما يكتبها أهل السوق. */
  addressOrder: ("street" | "district" | "city" | "region" | "postal")[];
};

export const MARKETS: Record<string, Market> = {
  EG: {
    code: "EG",
    locale: "ar-EG",
    timezone: "Africa/Cairo",
    currency: { code: "EGP", symbol: "ج.م", minorUnit: 100 },
    phone: { dial: "20", local: /^01[0125]\d{8}$/, trunk: "0", groups: [3, 4, 4] },
    addressOrder: ["street", "district", "city", "region"],
  },
  SA: {
    code: "SA",
    locale: "ar-SA",
    timezone: "Asia/Riyadh",
    currency: { code: "SAR", symbol: "ر.س", minorUnit: 100 },
    phone: { dial: "966", local: /^05\d{8}$/, trunk: "0", groups: [3, 3, 4] },
    addressOrder: ["street", "district", "city", "postal"],
  },
  AE: {
    code: "AE",
    locale: "ar-AE",
    timezone: "Asia/Dubai",
    currency: { code: "AED", symbol: "د.إ", minorUnit: 100 },
    phone: { dial: "971", local: /^05\d{8}$/, trunk: "0", groups: [3, 3, 4] },
    addressOrder: ["street", "district", "city", "region"],
  },
};

export const DEFAULT_MARKET = "EG";

/** السوق الفعّال: من NEXT_PUBLIC_MARKET (يُحقن وقت البناء في الواجهة أيضاً)، وأي قيمة مجهولة = الافتراضي. */
export function activeMarket(code: string | undefined = process.env.NEXT_PUBLIC_MARKET): Market {
  return MARKETS[(code ?? "").trim().toUpperCase()] ?? MARKETS[DEFAULT_MARKET]!;
}

const digits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** رقم هاتف بأي صيغة شائعة (محلي، +دولي، 00دولي) إلى الصيغة المحلية القياسية، أو null. */
export function normalizePhone(raw: string | null | undefined, m: Market = activeMarket()): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let s = digits(raw).replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  else if (s.startsWith("00")) s = s.slice(2);
  const { dial, trunk, local } = m.phone;
  if (s.startsWith(dial)) {
    let rest = s.slice(dial.length);
    if (rest.startsWith(trunk)) rest = rest.slice(trunk.length);
    s = trunk + rest;
  } else if (!s.startsWith(trunk)) s = trunk + s;
  return local.test(s) ? s : null;
}

/** الصيغة الدولية E.164 (+201012345678) للرسائل والروابط. */
export function toE164(raw: string, m: Market = activeMarket()): string | null {
  const p = normalizePhone(raw, m);
  return p ? `+${m.phone.dial}${p.slice(m.phone.trunk.length)}` : null;
}

/** عرض مقروء بتجميع السوق: 010 1234 5678. */
export function prettyLocalPhone(local: string, m: Market = activeMarket()): string {
  let i = 0;
  const parts = m.phone.groups.map((g) => {
    const p = local.slice(i, i + g);
    i += g;
    return p;
  });
  return i === local.length ? parts.join(" ") : local;
}

/** مبلغ بالوحدة الصغرى بعملة السوق: «1,250 ج.م» (بلا كسور إن كانت صفراً). */
export function formatMoney(minor: number, opts: { withSymbol?: boolean; market?: Market } = {}): string {
  const m = opts.market ?? activeMarket();
  const v = Math.round(Number.isFinite(minor) ? minor : 0);
  const frac = v % m.currency.minorUnit !== 0;
  const f = new Intl.NumberFormat(m.locale, { minimumFractionDigits: frac ? 2 : 0, maximumFractionDigits: frac ? 2 : 0, numberingSystem: "latn" }).format(v / m.currency.minorUnit);
  return opts.withSymbol === false ? f : `${f} ${m.currency.symbol}`;
}

/** عنوان من أجزائه بترتيب السوق، بلا أجزاء فارغة. */
export function formatAddress(parts: Partial<Record<Market["addressOrder"][number], string | null | undefined>>, m: Market = activeMarket()): string {
  return m.addressOrder
    .map((k) => (parts[k] ?? "").toString().replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("، ");
}

/** تاريخ ووقت بمنطقة السوق الزمنية. */
export function formatDateTime(d: Date | string | number | null | undefined, m: Market = activeMarket()): string {
  if (d === null || d === undefined) return "";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(`${m.locale}-u-nu-latn`, { timeZone: m.timezone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(date);
}

/** «منذ 5 د / 3 س / 2 ي» مختصرة للقوائم. */
export function shortAgo(d: Date | string | number | null | undefined, now = Date.now()): string {
  if (d === null || d === undefined) return "";
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return "";
  const min = Math.max(0, Math.round((now - t) / 60_000));
  if (min < 1) return "الآن";
  return min < 60 ? `${min} د` : min < 1440 ? `${Math.round(min / 60)} س` : `${Math.round(min / 1440)} ي`;
}
