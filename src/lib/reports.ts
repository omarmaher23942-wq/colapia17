// reports.ts — منطق خالص لتقارير المتجر: فترات التقرير، ربحية المنتجات، المبيعات بحسب القسم والقناة،
// قيمة المخزون والمنتجات الراكدة، ومعدل العملاء العائدين. لا قاعدة بيانات هنا، فكله قابل للاختبار.
import { cairoDate, cairoWallTime, nextCairoDay } from "@/lib/cairo-time";

export const PERIOD_PRESETS = ["today", "7", "30", "90", "month", "last_month", "custom"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];
export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  today: "اليوم",
  "7": "آخر 7 أيام",
  "30": "آخر 30 يوماً",
  "90": "آخر 90 يوماً",
  month: "هذا الشهر",
  last_month: "الشهر الماضي",
  custom: "فترة مخصصة",
};

export type Period = { preset: PeriodPreset; from: Date; to: Date; label: string; fromKey: string; toKey: string };

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_DAYS = 366;
const dayKey = (d: { y: number; m: number; d: number }) => `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
const startOf = (d: { y: number; m: number; d: number }) => cairoWallTime(d, 0);

function parseDay(s: string | undefined): { y: number; m: number; d: number } | null {
  const m = DAY_RE.exec(s ?? "");
  if (!m) return null;
  const v = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  if (v.m < 1 || v.m > 12 || v.d < 1 || v.d > 31) return null;
  const back = cairoDate(startOf(v));
  return back.y === v.y && back.m === v.m && back.d === v.d ? v : null;
}

/** فترة تقرير بتوقيت القاهرة: [from, to) — to حصرية. فترة مخصصة غير صالحة تعود لآخر 30 يوماً. */
export function resolvePeriod(q: { period?: string; from?: string; to?: string }, now = new Date()): Period {
  const today = cairoDate(now);
  const tomorrow = nextCairoDay(today);
  const shift = (n: number) => {
    let d = today;
    for (let i = 0; i < n; i++) d = cairoDate(new Date(startOf(d).getTime() - 12 * 3600_000));
    return d;
  };
  const make = (preset: PeriodPreset, a: { y: number; m: number; d: number }, bExcl: { y: number; m: number; d: number }): Period => {
    const lastIncl = cairoDate(new Date(startOf(bExcl).getTime() - 12 * 3600_000));
    return { preset, from: startOf(a), to: startOf(bExcl), label: PERIOD_LABEL[preset], fromKey: dayKey(a), toKey: dayKey(lastIncl) };
  };
  let preset = (PERIOD_PRESETS as readonly string[]).includes(q.period ?? "") ? (q.period as PeriodPreset) : "30";
  if (preset === "today") return make("today", today, tomorrow);
  if (preset === "7" || preset === "30" || preset === "90") return make(preset, shift(Number(preset) - 1), tomorrow);
  if (preset === "month") return make("month", { y: today.y, m: today.m, d: 1 }, tomorrow);
  if (preset === "last_month") {
    const prev = today.m === 1 ? { y: today.y - 1, m: 12, d: 1 } : { y: today.y, m: today.m - 1, d: 1 };
    return make("last_month", prev, { y: today.y, m: today.m, d: 1 });
  }
  const a = parseDay(q.from);
  const b = parseDay(q.to);
  if (a && b) {
    const end = nextCairoDay(b);
    const span = (startOf(end).getTime() - startOf(a).getTime()) / 86_400_000;
    if (span > 0 && span <= MAX_DAYS) {
      const p = make("custom", a, end);
      return { ...p, label: `${p.fromKey} إلى ${p.toKey}` };
    }
  }
  preset = "30";
  return make("30", shift(29), tomorrow);
}

// ───── ربحية المنتجات ─────
export type SoldLine = { productId: string | null; name: string; categoryName: string | null; qty: number; revenuePiasters: number; costPiasters: number | null };
export type ProductProfit = { key: string; name: string; categoryName: string | null; qty: number; revenuePiasters: number; costTotalPiasters: number | null; profitPiasters: number | null; marginPct: number | null };

/** يجمع بنود الطلبات لكل منتج. التكلفة تُحسب فقط إن عُرفت لكل وحدة؛ وإلا يظهر الربح «—» لا رقماً مخترعاً. */
export function profitByProduct(lines: SoldLine[]): ProductProfit[] {
  const map = new Map<string, ProductProfit & { unknownCost: boolean }>();
  for (const l of lines) {
    const key = l.productId ?? `n:${l.name}`;
    const cur = map.get(key) ?? { key, name: l.name, categoryName: l.categoryName, qty: 0, revenuePiasters: 0, costTotalPiasters: 0, profitPiasters: null, marginPct: null, unknownCost: false };
    cur.qty += l.qty;
    cur.revenuePiasters += l.revenuePiasters;
    if (l.costPiasters === null) cur.unknownCost = true;
    else cur.costTotalPiasters = (cur.costTotalPiasters ?? 0) + l.costPiasters * l.qty;
    map.set(key, cur);
  }
  return [...map.values()]
    .map(({ unknownCost, ...p }) => {
      if (unknownCost) return { ...p, costTotalPiasters: null, profitPiasters: null, marginPct: null };
      const profit = p.revenuePiasters - (p.costTotalPiasters ?? 0);
      return { ...p, profitPiasters: profit, marginPct: p.revenuePiasters > 0 ? Math.round((profit / p.revenuePiasters) * 100) : null };
    })
    .sort((a, b) => b.revenuePiasters - a.revenuePiasters);
}

export type Slice = { key: string; label: string; revenuePiasters: number; orders: number; sharePct: number };

function slices(rows: { key: string; label: string; revenuePiasters: number; orders: number }[]): Slice[] {
  const total = rows.reduce((s, r) => s + r.revenuePiasters, 0);
  return rows
    .map((r) => ({ ...r, sharePct: total > 0 ? Math.round((r.revenuePiasters / total) * 100) : 0 }))
    .sort((a, b) => b.revenuePiasters - a.revenuePiasters);
}

export function salesByCategory(lines: SoldLine[]): Slice[] {
  const m = new Map<string, { key: string; label: string; revenuePiasters: number; orders: number }>();
  for (const l of lines) {
    const label = l.categoryName?.trim() || "بدون قسم";
    const cur = m.get(label) ?? { key: label, label, revenuePiasters: 0, orders: 0 };
    cur.revenuePiasters += l.revenuePiasters;
    cur.orders += l.qty;
    m.set(label, cur);
  }
  return slices([...m.values()]);
}

/** قناة الطلب من `orders.source`: storefront، campaign:<slug>، chat:<مصدر>. */
export function channelOf(source: string | null | undefined): { key: string; label: string } {
  const s = (source ?? "storefront").trim();
  if (s.startsWith("campaign:")) return { key: "campaign", label: "حملات إعلانية" };
  if (s.startsWith("chat:")) {
    const map: Record<string, string> = { instagram: "إنستجرام", whatsapp: "واتساب", facebook: "فيسبوك", tiktok: "تيك توك", call: "مكالمة" };
    const k = s.slice(5);
    return { key: s, label: `شات · ${map[k] ?? "أخرى"}` };
  }
  return { key: "storefront", label: "واجهة المتجر" };
}

export function salesByChannel(orders: { source: string | null; totalPiasters: number }[]): Slice[] {
  const m = new Map<string, { key: string; label: string; revenuePiasters: number; orders: number }>();
  for (const o of orders) {
    const c = channelOf(o.source);
    const cur = m.get(c.key) ?? { key: c.key, label: c.label, revenuePiasters: 0, orders: 0 };
    cur.revenuePiasters += o.totalPiasters;
    cur.orders += 1;
    m.set(c.key, cur);
  }
  return slices([...m.values()]);
}

// ───── المخزون ─────
export type StockRow = { id: string; name: string; categoryName: string | null; stock: number | null; trackStock: boolean; pricePiasters: number; costPiasters: number | null; soldInWindow: number; lastSoldAt: Date | null };
export type InventoryLine = StockRow & { retailValue: number; costValue: number | null; daysCover: number | null; dead: boolean };
export type InventorySummary = { lines: InventoryLine[]; units: number; retailValue: number; costValue: number | null; costKnownPct: number; deadCount: number; deadValue: number };

export const DEAD_STOCK_DAYS = 60;

/** قيمة المخزون وأيام التغطية (من معدل البيع في نافذة التقرير) والراكد (لا بيع منذ DEAD_STOCK_DAYS ويوجد مخزون). */
export function inventoryReport(rows: StockRow[], windowDays: number, now = new Date()): InventorySummary {
  const lines: InventoryLine[] = [];
  let units = 0, retail = 0, cost = 0, withStock = 0, costKnown = 0, deadCount = 0, deadValue = 0;
  for (const r of rows) {
    if (!r.trackStock || r.stock === null || r.stock <= 0) continue;
    const rv = r.stock * r.pricePiasters;
    const cv = r.costPiasters === null ? null : r.stock * r.costPiasters;
    const perDay = windowDays > 0 ? r.soldInWindow / windowDays : 0;
    const daysCover = perDay > 0 ? Math.round(r.stock / perDay) : null;
    const idle = r.lastSoldAt === null ? Infinity : (now.getTime() - r.lastSoldAt.getTime()) / 86_400_000;
    const dead = idle >= DEAD_STOCK_DAYS;
    units += r.stock; retail += rv; withStock++;
    if (cv !== null) { cost += cv; costKnown++; }
    if (dead) { deadCount++; deadValue += rv; }
    lines.push({ ...r, retailValue: rv, costValue: cv, daysCover, dead });
  }
  lines.sort((a, b) => b.retailValue - a.retailValue);
  return { lines, units, retailValue: retail, costValue: costKnown === withStock && withStock > 0 ? cost : null, costKnownPct: withStock ? Math.round((costKnown / withStock) * 100) : 0, deadCount, deadValue };
}

// ───── العملاء العائدون ─────
export type RepeatStats = { customers: number; repeaters: number; repeatPct: number | null; avgOrdersPerCustomer: number | null; avgValuePiasters: number | null };

/** من عدد الطلبات المحققة لكل عميل (رقم الموبايل). */
export function repeatStats(perCustomer: { orders: number; spentPiasters: number }[]): RepeatStats {
  const customers = perCustomer.length;
  if (!customers) return { customers: 0, repeaters: 0, repeatPct: null, avgOrdersPerCustomer: null, avgValuePiasters: null };
  const repeaters = perCustomer.filter((c) => c.orders >= 2).length;
  const orders = perCustomer.reduce((s, c) => s + c.orders, 0);
  const spent = perCustomer.reduce((s, c) => s + c.spentPiasters, 0);
  return { customers, repeaters, repeatPct: Math.round((repeaters / customers) * 100), avgOrdersPerCustomer: Math.round((orders / customers) * 10) / 10, avgValuePiasters: Math.round(spent / customers) };
}
