// inject.ts — الملفات المحقونة بهوية العميل: إعداد المتجر، وتصميمه الأول (Blueprint)، وحزمة migrations المضمَّنة.
// خالص (بلا قاعدة بيانات ولا قرص): يستخدم من مولّد المشروع ومن الاختبارات.
import { createHash } from "node:crypto";
import { blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";
import { defaultBlueprint } from "@/blueprint/defaults";
import { applyTheme, isThemeId } from "@/blueprint/themes";
import { applyStarterTemplate, isTemplateId, templateForNiche } from "@/lib/store-templates";
import { isNiche } from "@/lib/niche-attributes";
import type { DeliveryIdentity } from "./types";

const json = (v: unknown) => JSON.stringify(v, null, 2);

/** اسم حساب إنستجرام من رابط أو @اسم أو اسم مجرد. */
export function instagramHandle(raw: string | null | undefined): string | undefined {
  const s = (raw ?? "").trim();
  if (!s) return undefined;
  const m = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(s);
  const h = (m?.[1] ?? s).replace(/^@/, "").replace(/[/?#].*$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : undefined;
}

/** المعرّف الداخلي للمتجر: لاتيني صغير بشرطات (يُستخدم نطاقاً فرعياً داخلياً ثابتاً، ولا يراه الزوار). */
export function normalizeSlug(raw: string): string {
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return s.length >= 3 ? s : "store";
}

/** التصميم الأول للمتجر: قالب النشاط (أو ما حدده الفريق) ببيانات العميل. العميل يعدّله كله من الإعداد واللوحة. */
export function seedBlueprint(id: DeliveryIdentity): StoreBlueprint {
  const niche = isNiche(id.niche) ? id.niche : "other";
  let bp = defaultBlueprint({
    name: id.storeName,
    industry: niche,
    instagramUsername: instagramHandle(id.instagram),
    whatsappNumber: id.whatsapp?.trim() || undefined,
    email: id.ownerEmail,
  });
  bp = applyStarterTemplate(bp, isTemplateId(id.templateId) ? id.templateId : templateForNiche(niche));
  if (isThemeId(id.themeId)) bp = applyTheme(bp, id.themeId);
  return blueprintSchema.parse(bp);
}

/** إعداد المشروع: هوية المتجر ورابط الوكالة لطلب التعديل. لا يحمل أي مفتاح سري. */
export function storeConfigFile(id: DeliveryIdentity, agencyUrl: string): string {
  const niche = isNiche(id.niche) ? id.niche : "other";
  return `// store.config.ts — هوية هذا المشروع (مولّد عند التسليم). لا يحتوي أي مفتاح سري: المفاتيح في متغيرات Cloudflare.
// \`slug\` معرّف داخلي ثابت لا يظهر للزوار، فلا تغيّروه بعد أول إعداد (يربط الصفوف في قاعدة البيانات).
export const STORE = {
  name: ${JSON.stringify(id.storeName)},
  slug: ${JSON.stringify(id.slug)},
  ownerEmail: ${JSON.stringify(id.ownerEmail.trim().toLowerCase())},
  niche: ${JSON.stringify(niche)},
  /** رابط طلب التعديل من الوكالة (رابط فقط، لا منطق). */
  agencyUrl: ${JSON.stringify(agencyUrl)},
  generatedAt: ${JSON.stringify(id.generatedAt ?? new Date().toISOString())},
} as const;
`;
}

export const blueprintFile = (bp: StoreBlueprint) => json(bp) + "\n";

// ─── migrations مضمَّنة ──────────────────────────────────────────────────────────
// Cloudflare Workers بلا قرص، فلا تُقرأ مجلدات SQL وقت التشغيل: تُضمَّن في وحدة TS تُنفَّذ من صفحة /setup بنفس
// جدول drizzle (drizzle.__drizzle_migrations)، فيبقى `drizzle-kit migrate` متوافقاً معها.

export type EmbeddedMigration = { tag: string; hash: string; folderMillis: number; statements: string[] };

export function embedMigrations(journalText: string, sqlByTag: Record<string, string>): EmbeddedMigration[] {
  const journal = JSON.parse(journalText) as { entries: { tag: string; when: number; breakpoints?: boolean }[] };
  return journal.entries.map((e) => {
    const raw = sqlByTag[e.tag];
    if (raw === undefined) throw new Error(`migration مفقود: ${e.tag}`);
    return {
      tag: e.tag,
      hash: createHash("sha256").update(raw).digest("hex"),
      folderMillis: e.when,
      statements: raw.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean),
    };
  });
}

export function migrationsModule(migrations: EmbeddedMigration[]): string {
  return `// migrations.generated.ts — مولّد من مجلد drizzle/ (لا يُحرَّر يدوياً؛ يُعاد توليده مع كل migration جديد: npm run db:embed).
// يُنفَّذ من صفحة /setup ومن src/server/setup/migrate.ts، فلا حاجة لقرص ولا لأمر في الطرفية.
export type EmbeddedMigration = { tag: string; hash: string; folderMillis: number; statements: string[] };
export const MIGRATIONS: EmbeddedMigration[] = ${json(migrations)};
`;
}
