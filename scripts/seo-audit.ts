// تدقيق السيو: npx tsx scripts/seo-audit.ts [--live] [--stores]
//  • افتراضياً: تدقيق إعداد المنصة (colapia.com) من الكود نفسه بلا شبكة ولا قاعدة (العنوان، الوصف، JSON-LD، robots، sitemap، llms).
//  • --live [الأصل]: يفحص النشر الفعلي (HTML وllms.txt وrobots وsitemap وملف مفتاح IndexNow) عبر HTTP.
//  • --stores: تدقيق عناوين وأوصاف المتاجر النشطة من القاعدة (يحتاج DATABASE_URL).
// يخرج برمز 1 عند وجود فشل في فحوص المنصة.
import { FAQ, SERVICES, WORKS, allCopy } from "../src/lib/landing-content";
import { AI_CRAWLERS, INDEXNOW_KEY, SITE_TITLE, graphFor, jsonLdText, llmsFullTxt, llmsTxt, platformRobots, platformSitemap, siteOrigin } from "../src/lib/platform-seo";

type Check = { ok: boolean; name: string; detail?: string };
const results: Check[] = [];
const check = (name: string, ok: boolean, detail?: string) => results.push({ ok, name, detail });

function auditPlatformConfig(origin: string) {
  check("العنوان يبدأ بالاسم الكامل «Colapia | كولابيا»", SITE_TITLE.startsWith("Colapia | كولابيا"), SITE_TITLE);
  check("العنوان ≤ 70 حرفاً", SITE_TITLE.length <= 70, `${SITE_TITLE.length}`);
  check("12 سؤالاً شائعاً بإجابات قصيرة", FAQ.length === 12 && FAQ.every((f) => f.a.length <= 330), `${FAQ.length}`);

  for (const page of ["home", "about", "work"] as const) {
    const g = (graphFor(page, origin) as { "@graph": Record<string, unknown>[] })["@graph"];
    const types = g.flatMap((n) => [n["@type"]].flat());
    check(`JSON-LD ${page}: Organization وWebSite`, types.includes("Organization") && types.includes("WebSite"));
    check(`JSON-LD ${page}: BreadcrumbList`, types.includes("BreadcrumbList"));
    check(`JSON-LD ${page}: بلا أسعار أو تقييمات`, !/"(price|ratingValue|aggregateRating|reviewRating)"/.test(jsonLdText(g)));
    if (page === "home") check("JSON-LD home: ProfessionalService وFAQPage", types.includes("ProfessionalService") && types.includes("FAQPage"));
    if (page === "work") check("JSON-LD work: دراسة حالة لكل عمل", g.filter((n) => JSON.stringify(n["@type"]).includes("CreativeWork")).length === WORKS.length);
  }
  const org = ((graphFor("home", origin) as { "@graph": Record<string, unknown>[] })["@graph"]).find((n) => n["@type"] === "Organization");
  check("Organization: sameAs غير فارغ", Array.isArray(org?.sameAs) && (org?.sameAs as unknown[]).length > 0);

  const rules = [platformRobots(origin).rules].flat();
  const aiRule = rules.find((r) => Array.isArray(r.userAgent));
  check("robots: زواحف الذكاء الاصطناعي مسموحة صراحةً", !!aiRule && AI_CRAWLERS.every((b) => (aiRule.userAgent as string[]).includes(b)));
  check("robots: خريطة الموقع معلنة", platformRobots(origin).sitemap === `${origin}/sitemap.xml`);

  const sm = platformSitemap(origin);
  check("sitemap: الرئيسية وabout وwork وterms وprivacy", ["", "/about", "/work", "/terms", "/privacy"].every((p) => sm.some((e) => e.url === `${origin}${p}`)));
  check("sitemap: كل صفحة بـ hreflang ar-EG وتاريخ تعديل", sm.every((e) => e.alternates?.languages?.["ar-EG"] && e.lastModified));

  check("llms.txt: عنوان واقتباس وروابط", llmsTxt(origin).startsWith("# Colapia | كولابيا") && llmsTxt(origin).includes("\n> ") && llmsTxt(origin).includes(`${origin}/about`));
  check("llms-full.txt: كل الخدمات والأسئلة", SERVICES.every((s) => llmsFullTxt(origin).includes(s.title)) && FAQ.every((f) => llmsFullTxt(origin).includes(f.q)));

  const copy = allCopy().join("\n");
  const banned = ["ج.م", "جنيه", "استضافة", "اشتراك", "تجربة مجانية", "الدائرة الذهبية", "الذكاء الاصطناعي", "متاجر إنستجرام"];
  check("النصوص بلا عبارات ممنوعة (أسعار، استضافة، اشتراك، ذكاء اصطناعي…)", banned.every((w) => !copy.includes(w)), banned.filter((w) => copy.includes(w)).join("، "));
}

async function auditLive(origin: string) {
  const get = async (path: string) => {
    const r = await fetch(`${origin}${path}`, { headers: { "User-Agent": "colapia-seo-audit" }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    return { status: r?.status ?? 0, text: r ? await r.text() : "", type: r?.headers.get("content-type") ?? "" };
  };
  for (const path of ["/", "/about", "/work"]) {
    const { status, text } = await get(path);
    check(`${path}: الحالة 200`, status === 200, `${status}`);
    check(`${path}: <title> يحوي Colapia`, /<title>[^<]*Colapia/.test(text));
    check(`${path}: canonical وhreflang ar-EG`, text.includes('rel="canonical"') && text.includes('hreflang="ar-EG"'));
    check(`${path}: og:image وog:locale`, text.includes('property="og:image"') && text.includes("ar_EG"));
    const ld = [...text.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => m[1]!);
    check(`${path}: JSON-LD صالح`, ld.length > 0 && ld.every((j) => { try { JSON.parse(j); return true; } catch { return false; } }));
    check(`${path}: عنوان رئيسي واحد (h1)`, (text.match(/<h1[\s>]/g) ?? []).length === 1);
  }
  const home = await get("/");
  check("الرئيسية: بلا أسعار ظاهرة", !/\d\s*ج\.م/.test(home.text));
  for (const f of ["/llms.txt", "/llms-full.txt", "/robots.txt", "/sitemap.xml", `/${INDEXNOW_KEY}.txt`]) {
    const r = await get(f);
    check(`${f}: 200`, r.status === 200, `${r.status}`);
    if (f === `/${INDEXNOW_KEY}.txt`) check("ملف مفتاح IndexNow يطابق المفتاح", r.text.trim() === INDEXNOW_KEY);
    if (f === "/robots.txt") check("robots.txt الفعلي يذكر GPTBot وClaudeBot", r.text.includes("GPTBot") && r.text.includes("ClaudeBot"));
  }
}

async function auditStores() {
  if (!process.env.DATABASE_URL) {
    console.log("\n(تخطي المتاجر: DATABASE_URL غير مضبوط)");
    return;
  }
  const [{ db }, { stores, storeBlueprints }, { eq }] = await Promise.all([import("../src/db/client"), import("../src/db/schema"), import("drizzle-orm")]);
  const active = await db
    .select({ id: stores.id, name: stores.name, subdomain: stores.subdomain, bp: storeBlueprints.data })
    .from(stores)
    .leftJoin(storeBlueprints, eq(storeBlueprints.storeId, stores.id))
    .where(eq(stores.status, "active"));

  let issuesCount = 0;
  for (const store of active) {
    const bp = store.bp as { seo?: { title?: string; description?: string } } | null;
    const issues: string[] = [];
    if (!bp?.seo?.title) issues.push("Missing SEO Title");
    if (!bp?.seo?.description) issues.push("Missing SEO Description");
    if (bp?.seo?.title && bp.seo.title.length > 60) issues.push("SEO Title too long (>60 chars)");
    if (bp?.seo?.description && bp.seo.description.length > 160) issues.push("SEO Description too long (>160 chars)");
    if (issues.length > 0) {
      console.log(`⚠️ Store: ${store.name} (${store.subdomain}.colapia.com)`);
      issues.forEach((i) => console.log(`   - ${i}`));
      issuesCount++;
    }
  }
  console.log(`\n✅ Stores audit complete. Issues in ${issuesCount} of ${active.length} active stores.`);
}

async function main() {
  const args = process.argv.slice(2);
  const liveIdx = args.indexOf("--live");
  const origin = liveIdx >= 0 && args[liveIdx + 1] && !args[liveIdx + 1]!.startsWith("--") ? args[liveIdx + 1]!.replace(/\/$/, "") : siteOrigin();

  auditPlatformConfig(origin);
  if (liveIdx >= 0) await auditLive(origin);

  for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.name}${r.ok || !r.detail ? "" : ` — ${r.detail}`}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${failed ? "❌" : "✅"} فحوص المنصة: ${results.length - failed}/${results.length} ناجحة${liveIdx >= 0 ? ` (حيّ: ${origin})` : " (إعداد الكود)"}`);

  if (args.includes("--stores")) await auditStores();
  process.exit(failed ? 1 : 0);
}

main();
