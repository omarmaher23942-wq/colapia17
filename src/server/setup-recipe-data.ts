import "server-only";
// setup-recipe-data.ts — يجمع مدخلات وصفة الإعداد من القاعدة ومجلد المتجر: إجابات طلب البناء (إن وُجد طلب مرتبط بالمتجر)،
// حقائق المتجر الفعلية، وتجاوز الفريق stores/<slug>/setup-recipe.json. الحساب نفسه في lib/setup-recipe.ts.
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storeRequests, type stores } from "@/db/schema";
import { buildRecipe, readAnswers, setupRecipeOverrideSchema, type Recipe, type StoreFacts } from "@/lib/setup-recipe";
import type { SetupData } from "@/lib/onboarding";
import { hasFolderData, storeSetupRecipe } from "@/stores/resolve";

type Base = Omit<SetupData, "recipe">;

export function factsFrom(store: typeof stores.$inferSelect, d: Base): StoreFacts {
  const ob = (store.onboarding ?? {}) as Record<string, unknown>;
  const vfNeedsNumber = d.payments.vodafone.enabled && !d.payments.vodafone.number.trim();
  const ipNeedsTarget = d.payments.instapay.enabled && !d.payments.instapay.target.trim();
  const transferOn = (d.payments.vodafone.enabled && !vfNeedsNumber) || (d.payments.instapay.enabled && !ipNeedsTarget);
  return {
    storeName: d.identity.name,
    hasLogo: Boolean(d.identity.logoUrl),
    products: { total: d.products.total, active: d.products.active, drafts: d.products.drafts },
    // مجلد مخصص للمتجر، أو قالب/تصميم اختاره الفريق أو التاجر من قبل.
    lookReady: hasFolderData(store.subdomain) || d.look.templateId !== null || d.look.themeId !== null,
    cod: d.payments.cod,
    transferReady: transferOn,
    transferIncomplete: vfNeedsNumber || ipNeedsTarget,
    inspectionAnswered: ob.inspectionAnswered === true || d.payments.inspection === true,
    whatsapp: Boolean(d.contact.whatsapp.trim()),
    zonesSaved: d.shipping.saved,
  };
}

export async function recipeFor(store: typeof stores.$inferSelect, d: Base): Promise<Recipe> {
  const [req] = await db
    .select({ data: storeRequests.data })
    .from(storeRequests)
    .where(eq(storeRequests.storeId, store.id))
    .orderBy(desc(storeRequests.createdAt))
    .limit(1)
    .catch(() => []);
  const parsed = setupRecipeOverrideSchema.safeParse(await storeSetupRecipe(store.subdomain).catch(() => null));
  return buildRecipe({ answers: readAnswers(req?.data), facts: factsFrom(store, d), override: parsed.success ? parsed.data : null });
}
