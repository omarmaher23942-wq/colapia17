// /api/dashboard/analytics/export — تقرير التحليلات ملف CSV يفتح في Excel (نفس أرقام الصفحة: analyticsReport):
// الأيام، ومصادر الزوار، ورحلة الشراء، والمحافظات، والمنتجات، والساعات.
import { getMerchantSession } from "@/server/auth";
import { analyticsReport, parseRange } from "@/server/repos/analytics";
import { csvResponse, egpCell, toCsv } from "@/server/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getMerchantSession();
  if (!session?.store) return Response.json({ error: "unauthorized" }, { status: 401 });
  const days = parseRange(new URL(req.url).searchParams.get("days") ?? undefined);
  const r = await analyticsReport(session.store.id, days);

  const rows: unknown[][] = [];
  const blank = () => rows.push([]);
  rows.push([`تقرير ${session.store.name}: آخر ${days} يوماً`]);
  rows.push(["الطلبات المحققة فقط (بلا الملغاة والمرتجعة وطلبات التجربة)، والأيام بتوقيت القاهرة"]);
  blank();
  rows.push(["الملخص", "هذه الفترة", "الفترة السابقة"]);
  rows.push(["المبيعات (ج.م)", egpCell(r.current.sales), egpCell(r.previous.sales)]);
  rows.push(["الطلبات", r.current.orders, r.previous.orders]);
  rows.push(["الزيارات", r.current.visits, r.previous.visits]);
  rows.push(["الزوار المختلفون", r.current.visitors, r.previous.visitors]);
  blank();
  rows.push(["اليوم", "المبيعات (ج.م)", "الطلبات", "الزيارات"]);
  for (const d of r.daily) rows.push([d.day, egpCell(d.sales), d.orders, d.visits]);
  blank();
  rows.push(["مصدر الزوار", "الزوار", "الطلبات", "المبيعات (ج.م)"]);
  for (const s of r.sources) rows.push([s.label, s.visitors, s.orders, egpCell(s.sales)]);
  blank();
  rows.push(["رحلة الشراء", "الزوار"]);
  rows.push(["زاروا المتجر", r.funnel.visitors]);
  rows.push(["شاهدوا منتجاً", r.funnel.viewers]);
  rows.push(["أضافوا للسلة", r.funnel.carters]);
  rows.push(["بدؤوا الدفع", r.funnel.checkouts]);
  rows.push(["طلبوا", r.funnel.buyers]);
  blank();
  rows.push(["المنتج", "القطع", "المبيعات (ج.م)"]);
  for (const p of r.products) rows.push([p.name, p.qty, egpCell(p.sales)]);
  blank();
  rows.push(["المحافظة", "الطلبات", "المبيعات (ج.م)"]);
  for (const g of r.governorates) rows.push([g.name, g.orders, egpCell(g.sales)]);
  blank();
  rows.push(["الساعة (القاهرة)", "الطلبات"]);
  r.hours.forEach((n, h) => rows.push([`${String(h).padStart(2, "0")}:00`, n]));

  return csvResponse(`analytics-${session.store.subdomain}-${days}d`, toCsv([], rows).replace(/^﻿\r\n/, "﻿"));
}
