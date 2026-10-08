// يعيد حساب products.search_text لكل المنتجات بالصيغة الحالية لـ buildSearchText
// (بعد تغيير صيغ الفرانكو). يحدّث الصفوف المختلفة فقط، على دفعات.
// الاستخدام: npm run db:reindex-search
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { buildSearchText } from "../src/lib/arabic";

config({ path: ".env.local" });
config();

type Row = {
  id: string;
  name: string;
  short_description: string | null;
  description: string | null;
  tags: string[] | null;
  attributes: { value?: string }[] | null;
  search_text: string | null;
};

const PAGE = 500;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL غير موجود في .env.local أو .env");
  const sql = neon(url);

  let after = "00000000-0000-0000-0000-000000000000";
  let scanned = 0;
  let updated = 0;

  for (;;) {
    const rows = (await sql.query(
      `SELECT id, name, short_description, description, tags, attributes, search_text
       FROM products WHERE id > $1 ORDER BY id LIMIT ${PAGE}`,
      [after]
    )) as Row[];
    if (!rows.length) break;

    const changed = rows
      .map((r) => ({
        id: r.id,
        next: buildSearchText([
          r.name,
          r.short_description,
          r.description,
          ...(r.tags ?? []),
          ...(r.attributes ?? []).map((a) => a.value),
        ]),
        prev: r.search_text,
      }))
      .filter((r) => r.next !== r.prev);

    if (changed.length) {
      await sql.query(
        `UPDATE products p SET search_text = v.t
         FROM unnest($1::uuid[], $2::text[]) AS v(id, t) WHERE p.id = v.id`,
        [changed.map((c) => c.id), changed.map((c) => c.next)]
      );
    }

    scanned += rows.length;
    updated += changed.length;
    after = rows[rows.length - 1]!.id;
    console.log(`… ${scanned} منتج، حُدّث ${updated}`);
  }

  console.log(`✓ انتهت إعادة الفهرسة: ${scanned} منتج، حُدّث ${updated}`);
}

main().catch((e) => {
  console.error("✗ فشل:", e instanceof Error ? e.message : e);
  process.exit(1);
});
