// embed-migrations.mjs — يضمّن ملفات drizzle/*.sql في src/db/migrations.generated.ts لتُنفَّذ من صفحة /setup على Cloudflare
// (لا قرص هناك). شغّلوه بعد كل `drizzle-kit generate` (npm run db:generate يفعل ذلك تلقائياً). الصيغة مطابقة لما يولّده مسلِّم المشروع.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
const migrations = journal.entries.map((e) => {
  const raw = readFileSync(`drizzle/${e.tag}.sql`, "utf8");
  return {
    tag: e.tag,
    hash: createHash("sha256").update(raw).digest("hex"),
    folderMillis: e.when,
    statements: raw
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean),
  };
});

writeFileSync(
  "src/db/migrations.generated.ts",
  `// migrations.generated.ts — مولّد من مجلد drizzle/ (لا يُحرَّر يدوياً؛ يُعاد توليده مع كل migration جديد: npm run db:embed).
// يُنفَّذ من صفحة /setup ومن src/server/setup/migrate.ts، فلا حاجة لقرص ولا لأمر في الطرفية.
export type EmbeddedMigration = { tag: string; hash: string; folderMillis: number; statements: string[] };
export const MIGRATIONS: EmbeddedMigration[] = ${JSON.stringify(migrations, null, 2)};
`
);
console.log(`✓ ${migrations.length} migration مضمّن في src/db/migrations.generated.ts`);
