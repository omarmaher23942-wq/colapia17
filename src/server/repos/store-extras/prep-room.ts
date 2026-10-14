// prep-room.ts — بيانات «غرفة التجهيز» (لوحة مخصصة لمتجر نور للملابس، store-extras.ts): الطلبات التي تنتظر
// التجهيز مجمّعة بالقطعة والمقاس، وبطاقات التعبئة لكل طلب، وطلب كل مقاس في الفترة ومن ينتظر توفره.
// بيانات المتجر نفسه فقط عبر getTenantDb، وبلا الطلبات التجريبية.
import "server-only";
import { sql } from "drizzle-orm";
import { getTenantDb } from "@/db/tenant";

export type PrepScope = "ready" | "all";
export const PREP_STATUSES: Record<PrepScope, string[]> = { ready: ["confirmed", "preparing"], all: ["new", "confirmed", "preparing"] };

export type PickLine = { key: string; productId: string | null; name: string; variant: string | null; image: string | null; qty: number; orders: { id: string; code: string }[] };
export type PackOrder = {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  governorate: string;
  city: string | null;
  address: string;
  landmark: string | null;
  notes: string | null;
  paymentMethod: string;
  paymentStatus: string;
  totalPiasters: number;
  items: { name: string; variant: string | null; qty: number }[];
};
export type SizeDemand = { productId: string; name: string; image: string | null; sizes: { label: string; sold: number; waiting: number }[]; sold: number; waiting: number };
export type PrepData = { pick: PickLine[]; pack: PackOrder[]; demand: SizeDemand[]; days: number };

type Row = Record<string, unknown>;
const rows = (r: unknown): Row[] => ((r as { rows?: Row[] }).rows ?? (r as Row[])) as Row[];
const num = (v: unknown) => Number(v ?? 0) || 0;
const str = (v: unknown) => (v == null ? null : String(v));

export async function prepRoomData(storeId: string, scope: PrepScope, days: 30 | 90): Promise<PrepData> {
  const db = await getTenantDb(storeId);
  const statuses = PREP_STATUSES[scope];
  const statusList = sql.join(statuses.map((s) => sql`${s}`), sql`, `);
  const [orderRows, itemRows, soldRows, waitRows] = await Promise.all([
    db.execute(sql`
      select o.id, o.code, o.status, o.created_at, o.customer_name, o.customer_phone, o.governorate, o.city, o.address, o.landmark,
             o.customer_notes, o.payment_method, o.payment_status, o.total_piasters
      from orders o
      where o.store_id = ${storeId} and o.is_test = false and o.status in (${statusList})
      order by o.created_at asc
      limit 200`),
    db.execute(sql`
      select i.order_id, i.product_id, i.name, i.variant_label, i.image_url, i.quantity
      from order_items i join orders o on o.id = i.order_id
      where i.store_id = ${storeId} and o.store_id = ${storeId} and o.is_test = false and o.status in (${statusList})
      order by o.created_at asc
      limit 2000`),
    // الطلب الفعلي في الفترة: كل ما لم يُلغَ ولم يُرتجع، لمنتجات لها خيارات (مقاس/لون) فقط.
    db.execute(sql`
      select p.id as product_id, p.name, p.images->0->>'url' as image, p.option_names, coalesce(i.variant_label, '') as label, sum(i.quantity)::int as qty
      from order_items i
      join orders o on o.id = i.order_id
      join products p on p.id = i.product_id
      where i.store_id = ${storeId} and o.store_id = ${storeId} and p.store_id = ${storeId} and o.is_test = false
        and o.status not in ('cancelled', 'returned')
        and o.created_at >= now() - make_interval(days => ${days})
        and jsonb_array_length(p.option_names) > 0
      group by p.id, p.name, image, p.option_names, label`),
    db.execute(sql`
      select a.product_id, p.name, p.images->0->>'url' as image, coalesce(a.variant_label, '') as label, count(*)::int as n
      from stock_alerts a join products p on p.id = a.product_id
      where a.store_id = ${storeId} and p.store_id = ${storeId} and a.notified_at is null
      group by a.product_id, p.name, image, label`),
  ]);

  const byOrder = new Map<string, PackOrder>();
  for (const r of rows(orderRows)) {
    byOrder.set(String(r.id), {
      id: String(r.id),
      code: String(r.code),
      status: String(r.status),
      createdAt: new Date(String(r.created_at)).toISOString(),
      customerName: String(r.customer_name),
      customerPhone: String(r.customer_phone),
      governorate: String(r.governorate),
      city: str(r.city),
      address: String(r.address),
      landmark: str(r.landmark),
      notes: str(r.customer_notes),
      paymentMethod: String(r.payment_method),
      paymentStatus: String(r.payment_status),
      totalPiasters: num(r.total_piasters),
      items: [],
    });
  }

  const pick = new Map<string, PickLine>();
  for (const r of rows(itemRows)) {
    const order = byOrder.get(String(r.order_id));
    if (!order) continue;
    const variant = str(r.variant_label) || null;
    const qty = num(r.quantity);
    order.items.push({ name: String(r.name), variant, qty });
    const key = `${r.product_id ?? r.name}|${variant ?? ""}`;
    const line = pick.get(key) ?? { key, productId: str(r.product_id), name: String(r.name), variant, image: str(r.image_url), qty: 0, orders: [] };
    line.qty += qty;
    if (!line.orders.some((o) => o.id === order.id)) line.orders.push({ id: order.id, code: order.code });
    pick.set(key, line);
  }

  const demand = new Map<string, SizeDemand>();
  const touch = (id: string, name: string, image: string | null) => {
    const d = demand.get(id) ?? { productId: id, name, image, sizes: [], sold: 0, waiting: 0 };
    demand.set(id, d);
    return d;
  };
  const sizeOf = (d: SizeDemand, label: string) => {
    const l = label || "بلا خيار";
    let s = d.sizes.find((x) => x.label === l);
    if (!s) d.sizes.push((s = { label: l, sold: 0, waiting: 0 }));
    return s;
  };
  for (const r of rows(soldRows)) {
    const d = touch(String(r.product_id), String(r.name), str(r.image));
    const q = num(r.qty);
    sizeOf(d, String(r.label)).sold += q;
    d.sold += q;
  }
  for (const r of rows(waitRows)) {
    const d = touch(String(r.product_id), String(r.name), str(r.image));
    const n = num(r.n);
    sizeOf(d, String(r.label)).waiting += n;
    d.waiting += n;
  }
  const numeric = (a: string) => (/^\d+(\.\d+)?$/.test(a) ? Number(a) : NaN);
  for (const d of demand.values()) {
    d.sizes.sort((a, b) => {
      const x = numeric(a.label), y = numeric(b.label);
      return Number.isNaN(x) || Number.isNaN(y) ? a.label.localeCompare(b.label, "ar") : x - y;
    });
  }

  return {
    pick: [...pick.values()].sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, "ar")),
    pack: [...byOrder.values()],
    demand: [...demand.values()].sort((a, b) => b.sold + b.waiting - (a.sold + a.waiting)),
    days,
  };
}
