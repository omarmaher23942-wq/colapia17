// يعتمد قاعدة قائمة (الإنتاج) على خط الأساس drizzle/0000_baseline.sql مرة واحدة.
//
// 1. يقارن القاعدة بخط الأساس، ويضيف الناقص فقط: امتدادات، أنواع enum وقيمها، جداول، أعمدة، قيود، فهارس.
//    لا يحذف شيئاً ولا يعدّل عموداً قائماً.
// 2. يسجّل خط الأساس في drizzle.__drizzle_migrations، فيعمل `npm run db:migrate` بعدها على كل قاعدة.
//
// الاستخدام:
//   npm run db:adopt-baseline            ← معاينة فقط (لا يكتب شيئاً)
//   npm run db:adopt-baseline -- --apply ← تنفيذ
import { config } from "dotenv";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });
config();

const BASELINE = "drizzle/0000_baseline.sql";
const JOURNAL = "drizzle/meta/_journal.json";
const apply = process.argv.includes("--apply");

type Step = { why: string; sql: string; warn?: string; blocked?: boolean };

// صيغة موحّدة لتعريف فهرس، تصلح لمقارنة ناتج pg_indexes مع أوامر خط الأساس.
function indexKey(def: string): string {
  const m = def.match(/^CREATE (UNIQUE )?INDEX \S+ ON (?:ONLY )?(\S+) USING (\w+) \((.+?)\)(?: WHERE (.+?))?;?$/is);
  if (!m) return def;
  const norm = (x: string) => x.replace(/"/g, "").replace(/::[a-z ]+/gi, "").replace(/public\./g, "").replace(/[\s()]/g, "").toLowerCase();
  return [m[1] ? "u" : "i", norm(m[2]!), m[3]!.toLowerCase(), norm(m[4]!), norm(m[5] ?? "")].join("|");
}

const unq = (s: string) => s.replace(/^"public"\./, "").replace(/"/g, "");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL غير موجود في .env.local أو .env");
  const sql = neon(url);
  const q = async <T>(text: string, params: unknown[] = []) => (await sql.query(text, params)) as T[];

  const fileText = readFileSync(BASELINE, "utf8");
  const statements = fileText
    .split("--> statement-breakpoint")
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);

  // حالة القاعدة الحالية.
  const tables = new Set(
    (await q<{ t: string }>(`SELECT table_name t FROM information_schema.tables WHERE table_schema='public'`)).map((r) => r.t)
  );
  const columns = new Set(
    (
      await q<{ t: string; c: string }>(
        `SELECT table_name t, column_name c FROM information_schema.columns WHERE table_schema='public'`
      )
    ).map((r) => `${r.t}.${r.c}`)
  );
  const constraints = new Set(
    (
      await q<{ n: string }>(
        `SELECT conname n FROM pg_constraint c JOIN pg_namespace s ON s.oid=c.connamespace WHERE s.nspname='public'`
      )
    ).map((r) => r.n)
  );
  const indexes = new Set(
    (await q<{ n: string }>(`SELECT indexname n FROM pg_indexes WHERE schemaname='public'`)).map((r) => r.n)
  );
  // تعريفات قائمة لمقارنة المعنى لا الاسم: مفتاح أجنبي = جدول(أعمدة)->جدول، فهرس = نوعه وجدوله وأعمدته وشرطه.
  const fkKeys = new Set(
    (
      await q<{ k: string }>(
        `SELECT c.conrelid::regclass::text || '(' || string_agg(a.attname, ',' ORDER BY x.ord) || ')->' || c.confrelid::regclass::text k
         FROM pg_constraint c
         CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY x(attnum, ord)
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = x.attnum
         WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
         GROUP BY c.oid, c.conrelid, c.confrelid`
      )
    ).map((r) => r.k)
  );
  const indexKeys = new Set(
    (await q<{ d: string }>(`SELECT indexdef d FROM pg_indexes WHERE schemaname='public'`)).map((r) => indexKey(r.d))
  );
  const enumValues = new Map<string, Set<string>>();
  for (const r of await q<{ t: string; v: string }>(
    `SELECT t.typname t, e.enumlabel v FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
     JOIN pg_namespace s ON s.oid=t.typnamespace WHERE s.nspname='public'`
  )) {
    if (!enumValues.has(r.t)) enumValues.set(r.t, new Set());
    enumValues.get(r.t)!.add(r.v);
  }

  const steps: Step[] = [];
  const expectedTables = new Set<string>();

  for (const st of statements) {
    let m: RegExpMatchArray | null;

    if (/^CREATE EXTENSION/i.test(st)) {
      steps.push({ why: "امتداد", sql: st });
    } else if ((m = st.match(/^CREATE TYPE ("[^"]+"\."[^"]+"|"[^"]+") AS ENUM\((.*)\);?$/s))) {
      const name = unq(m[1]!);
      const values = [...m[2]!.matchAll(/'((?:[^']|'')*)'/g)].map((x) => x[1]!);
      const have = enumValues.get(name);
      if (!have) steps.push({ why: `نوع enum ناقص: ${name}`, sql: st });
      else
        for (const v of values.filter((v) => !have.has(v)))
          steps.push({ why: `قيمة enum ناقصة: ${name}.${v}`, sql: `ALTER TYPE ${m[1]} ADD VALUE IF NOT EXISTS '${v}'` });
    } else if ((m = st.match(/^CREATE TABLE "([^"]+)" \((.*)\);?$/s))) {
      const table = m[1]!;
      expectedTables.add(table);
      if (!tables.has(table)) {
        steps.push({ why: `جدول ناقص: ${table}`, sql: st });
        continue;
      }
      for (const raw of m[2]!.split("\n")) {
        const line = raw.trim().replace(/,$/, "");
        const col = line.match(/^"([^"]+)" /);
        const con = line.match(/^CONSTRAINT "([^"]+)" /);
        if (col && !columns.has(`${table}.${col[1]}`))
          steps.push({ why: `عمود ناقص: ${table}.${col[1]}`, sql: `ALTER TABLE "${table}" ADD COLUMN ${line}` });
        else if (con && !constraints.has(con[1]!))
          steps.push({ why: `قيد ناقص: ${con[1]}`, sql: `ALTER TABLE "${table}" ADD ${line}` });
      }
    } else if ((m = st.match(/^ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" FOREIGN KEY \(([^)]+)\) REFERENCES "public"\."([^"]+)"\("([^"]+)"\)/))) {
      const [, table, name, colsRaw, ref, refCol] = m as unknown as string[];
      const cols = colsRaw!.replace(/"/g, "").split(",").map((c) => c.trim());
      if (constraints.has(name!) || fkKeys.has(`${table}(${cols.join(",")})->${ref}`)) continue;
      // صفوف قديمة تشير إلى غير موجود: يُضاف القيد NOT VALID فيُفرض على الجديد دون أن يفشل على القديم.
      const orphans = (
        await q<{ n: number }>(
          `SELECT count(*)::int n FROM "${table}" x WHERE x."${cols[0]}" IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM "${ref}" y WHERE y."${refCol}" = x."${cols[0]}")`
        )
      )[0]!.n;
      steps.push(
        orphans
          ? { why: `مفتاح أجنبي ناقص: ${name}`, sql: `${st.replace(/;$/, "")} NOT VALID`, warn: `${orphans} صف يتيم قديم، أُضيف NOT VALID` }
          : { why: `مفتاح أجنبي ناقص: ${name}`, sql: st }
      );
    } else if ((m = st.match(/^CREATE (UNIQUE )?INDEX "([^"]+)" ON "([^"]+)" USING \w+ \((.+?)\)(?: WHERE (.+?))?;?$/s))) {
      const [, unique, name, table, colsRaw, where] = m as unknown as (string | undefined)[];
      if (indexes.has(name!) || indexKeys.has(indexKey(st))) continue;
      if (unique) {
        const cols = colsRaw!.split(",").map((c) => c.trim());
        const cond = [...cols.map((c) => `${c} IS NOT NULL`), ...(where ? [`(${where})`] : [])].join(" AND ");
        const dups = (
          await q<{ n: number }>(
            `SELECT count(*)::int n FROM (SELECT 1 FROM "${table}" WHERE ${cond} GROUP BY ${cols.join(",")} HAVING count(*) > 1) d`
          )
        )[0]!.n;
        if (dups) {
          steps.push({ why: `فهرس فريد ناقص: ${name}`, sql: st, warn: `${dups} قيمة مكررة في البيانات، يلزم تنظيفها أولاً`, blocked: true });
          continue;
        }
      }
      steps.push({ why: `فهرس ناقص: ${name}`, sql: st });
    } else {
      throw new Error(`أمر غير متوقع في خط الأساس:\n${st.slice(0, 200)}`);
    }
  }

  const extra = [...tables].filter((t) => !expectedTables.has(t)).sort();

  console.log(`\nخط الأساس: ${statements.length} أمر. القاعدة: ${tables.size} جدول.`);
  if (extra.length) console.log(`جداول موجودة خارج المخطط (لن تُمس): ${extra.join(", ")}`);
  const real = steps.filter((s) => s.why !== "امتداد");
  console.log(real.length ? `\nالفروق (${real.length}):` : "\nلا فروق: القاعدة مطابقة لخط الأساس.");
  for (const s of real) console.log(`  • ${s.why}${s.warn ? `  ⚠ ${s.warn}` : ""}`);
  const blocked = real.filter((s) => s.blocked);

  const journal = JSON.parse(readFileSync(JOURNAL, "utf8")) as { entries: { tag: string; when: number }[] };
  const entry = journal.entries.find((e) => e.tag === "0000_baseline");
  if (!entry) throw new Error("خط الأساس غير موجود في الـ journal");
  const hash = createHash("sha256").update(fileText).digest("hex");

  if (!apply) {
    console.log("\nمعاينة فقط. للتنفيذ: npm run db:adopt-baseline -- --apply");
    return;
  }

  if (blocked.length) {
    throw new Error(`${blocked.length} فهرس فريد لا يمكن إنشاؤه بسبب بيانات مكررة. لم يُنفَّذ شيء.`);
  }
  for (const s of steps) {
    console.log(`→ ${s.why}`);
    await sql.query(s.sql);
  }

  await sql.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await sql.query(
    `CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`
  );
  const marked = await q<{ n: number }>(
    `SELECT count(*)::int n FROM drizzle.__drizzle_migrations WHERE created_at >= $1`,
    [entry.when]
  );
  if (marked[0]!.n === 0) {
    await sql.query(`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`, [hash, entry.when]);
    console.log("→ سُجّل خط الأساس كمطبَّق");
  }
  console.log("\n✓ القاعدة معتمدة على خط الأساس. أي تعديل قادم: npm run db:migrate");
}

main().catch((e) => {
  console.error("✗ فشل:", e instanceof Error ? e.message : e);
  process.exit(1);
});
