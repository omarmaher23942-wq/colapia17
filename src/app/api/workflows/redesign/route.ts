// POST /api/workflows/redesign — إعادة تصميم متجر قائم بالذكاء الاصطناعي (مدير فني + كاتب محتوى).
// يغيّر الشكل والنصوص والصفحة الرئيسية فقط، ويحفظ النسخة السابقة لاستعادتها بضغطة.
// الحالة تُحفظ في Redis لتعرضها لوحة التحكم أثناء العمل.
import { serve } from "@upstash/workflow/nextjs";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { buildJobs, intakes, storeBlueprints, storeSnapshots, stores } from "@/db/schema";
import { env } from "@/lib/env";
import { setRedesignState } from "@/server/redesign";
import { blueprintSchema, type StoreBlueprint } from "@/blueprint/schema";
import { getStoreFacts } from "@/server/repos/facts";
import { invalidateStoreCache } from "@/lib/tenant";
import { designStore, writeStore, type StudioCopy, type StudioDesign } from "@/ai/build/studio";
import { redesignBlueprint } from "@/ai/build/art-director";
import { catalogStats } from "@/ai/build/catalog-stats";
import { fallbackPlan, normalizePlan, type Degraded, type IntakeLike } from "@/ai/build/composer";
import type { Plan } from "@/ai/build/schemas";

export const maxDuration = 60;

type Input = { storeId: string; nonce: string };

const setState = setRedesignState;

export const { POST } = serve<Input>(
  async (ctx) => {
    if (ctx.headers.get("x-internal") !== env.QSTASH_INTERNAL_SECRET) throw new Error("forbidden");
    const { storeId, nonce } = ctx.requestPayload;

    const loaded = await ctx.run("load", async () => {
      await setState(storeId, { status: "running", step: "load" });
      const [[intake], [bpRow], [job]] = await Promise.all([
        db.select().from(intakes).where(eq(intakes.storeId, storeId)).limit(1),
        db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, storeId)).limit(1),
        db.select({ plan: buildJobs.plan }).from(buildJobs).where(eq(buildJobs.storeId, storeId)).orderBy(desc(buildJobs.createdAt)).limit(1),
      ]);
      if (!intake || !bpRow) throw new Error("store has no intake or blueprint");
      const bp = blueprintSchema.parse(bpRow.data);
      const like = intake as unknown as IntakeLike;
      const fallback = fallbackPlan(like);
      const plan = job?.plan ? normalizePlan(job.plan, fallback) : fallback;
      // اسم المتجر الحالي (قد يكون التاجر غيّره من اللوحة) هو المرجع.
      plan.brandDirection.name = bp.brand.name;
      return { intake: like, plan, concept: bp.design.concept, facts: await getStoreFacts(storeId, bp) };
    });

    const degraded: Degraded[] = [];
    const design = await ctx.run<StudioDesign>("design", async () => {
      await setState(storeId, { step: "design" });
      return designStore(loaded.intake, loaded.plan as Plan, storeId, degraded, loaded.facts, { concept: loaded.concept, nonce });
    });

    const copy = await ctx.run<StudioCopy>("copy", async () => {
      await setState(storeId, { step: "copy" });
      return writeStore(loaded.intake, loaded.plan as Plan, design, storeId, degraded, loaded.facts);
    });

    await ctx.run("save", async () => {
      await setState(storeId, { step: "save" });
      const [[cur], [store]] = await Promise.all([
        db.select().from(storeBlueprints).where(eq(storeBlueprints.storeId, storeId)).limit(1),
        db.select({ id: stores.id, subdomain: stores.subdomain }).from(stores).where(eq(stores.id, storeId)).limit(1),
      ]);
      if (!cur || !store) throw new Error("store vanished");
      const current = blueprintSchema.parse(cur.data);
      const brief = (loaded.intake.brief ?? {}) as { features?: Record<string, boolean> };
      const next: StoreBlueprint = blueprintSchema.parse(redesignBlueprint(current, { design, copy }, await catalogStats(storeId), brief.features));
      const version = cur.version + 1;
      const now = new Date();
      await db.batch([
        db.insert(storeSnapshots).values({ storeId, version: cur.version, data: cur.data, label: "قبل إعادة التصميم بالذكاء الاصطناعي", createdBy: "ai" }).onConflictDoNothing({ target: [storeSnapshots.storeId, storeSnapshots.version] }),
        db.update(storeBlueprints).set({ version, data: next, updatedBy: "ai", updatedAt: now }).where(eq(storeBlueprints.storeId, storeId)),
        db.execute(sql`delete from store_snapshots where store_id = ${storeId} and id not in (select id from store_snapshots where store_id = ${storeId} order by version desc limit 50)`),
      ] as never);
      await invalidateStoreCache(store);
      await setState(storeId, { status: "done", step: undefined, finishedAt: new Date().toISOString(), concept: next.design.concept, error: undefined });
    });
  },
  {
    retries: 1,
    failureFunction: async ({ context, failResponse }) => {
      const { storeId } = context.requestPayload as Input;
      await setState(storeId, { status: "failed", finishedAt: new Date().toISOString(), error: String(failResponse).slice(0, 300) }).catch(() => {});
    },
  }
);
