import "dotenv/config";
import { db } from "../src/db/client";
import { stores, storeBlueprints } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function auditSEO() {
  console.log("🔍 Starting SEO Audit for Active Stores...\n");

  const activeStores = await db
    .select({ id: stores.id, name: stores.name, subdomain: stores.subdomain, bp: storeBlueprints.data })
    .from(stores)
    .leftJoin(storeBlueprints, eq(storeBlueprints.storeId, stores.id))
    .where(eq(stores.status, "active"));

  let issuesCount = 0;

  for (const store of activeStores) {
    const bp: any = store.bp;
    const issues: string[] = [];

    if (!bp?.seo?.title) issues.push("Missing SEO Title");
    if (!bp?.seo?.description) issues.push("Missing SEO Description");
    if (bp?.seo?.title && bp.seo.title.length > 60) issues.push("SEO Title too long (>60 chars)");
    if (bp?.seo?.description && bp.seo.description.length > 160) issues.push("SEO Description too long (>160 chars)");

    if (issues.length > 0) {
      console.log(`⚠️ Store: ${store.name} (${store.subdomain}.colapia.com)`);
      issues.forEach(i => console.log(`   - ${i}`));
      issuesCount++;
    }
  }

  console.log(`\n✅ Audit Complete. Found issues in ${issuesCount} out of ${activeStores.length} active stores.`);
  process.exit(0);
}

auditSEO();