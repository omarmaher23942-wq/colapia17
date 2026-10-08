import { serve } from "@upstash/workflow/nextjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getTenantDb } from "@/db/tenant";
import {
  buildJobs,
  intakes,
  stores,
  storeBlueprints,
  storeSnapshots,
  categories,
  products,
  productVariants,
  shippingZones,
  systemEvents,
  merchants,
} from "@/db/schema";
import { env } from "@/lib/env";
import { storeUrl } from "@/lib/utils";
import {
  architect,
  productBatches,
  composeProductsBatch,
  composePagesGroup,
  mergePages,
  assemble,
  runQa,
  applyFixes,
  type Degraded,
} from "@/ai/build/composer";
import type { Plan, ProductOut, PagesOut } from "@/ai/build/schemas";
import { designStore, writeStore, type StudioCopy, type StudioDesign } from "@/ai/build/studio";
import { composeHome, type CatalogStats } from "@/ai/build/art-director";
import { catalogStats } from "@/ai/build/catalog-stats";
import type { StoreBlueprint } from "@/blueprint/schema";
import { repairBlueprint } from "@/blueprint/repair";
import { defaultShippingZones } from "@/lib/egypt";
import { buildSearchText, slugify } from "@/lib/arabic";
import { cancelJobs, scheduleDelivery } from "@/lifecycle/scheduler";
import { transition } from "@/lifecycle/machine";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { sendMerchantStoreReadyEmail } from "@/lib/email";
import {
  emitBuildProgress,
  emitBuildCompleted,
} from "@/server/realtime/emitters";

export const maxDuration = 60;

type Input = {
  storeId: string;
  intakeId: string;
  conversationId: string;
  jobId: string;
  merchantId?: string;
};
type Intake = typeof intakes.$inferSelect;
type Catalog = {
  cats: { slug: string; name: string }[];
  products: { slug: string; name: string }[];
  stats: CatalogStats;
};
type Step<T> = { value: T; degraded: Degraded[] };
type ZoneIn = {
  governorate: string;
  feeEgp: number;
  etaMinDays?: number;
  etaMaxDays?: number;
  active?: boolean;
};

const mark = async (
  jobId: string,
  name: string,
  status: "running" | "done" | "failed" | "degraded",
  extra: Record<string, unknown> = {},
  merchantId?: string
) => {
  await db
    .update(buildJobs)
    .set({
      steps: sql`coalesce(${buildJobs.steps}, '[]'::jsonb) || ${JSON.stringify(
        [
          {
            name,
            status,
            [status === "running" ? "startedAt" : "endedAt"]:
              new Date().toISOString(),
            ...extra,
          },
        ]
      )}::jsonb`,
      ...(status === "failed" ? { status: "failed" } : {}),
    })
    .where(eq(buildJobs.id, jobId));

  if (merchantId) {
    void emitBuildProgress(merchantId, {
      jobId,
      step: name,
      progress: status === "done" ? 100 : 0,
      status: status === "degraded" ? "degraded" : status,
      message: `${name} (${status})`,
    });
  }
};

async function unit<T>(
  jobId: string,
  name: string,
  fn: (d: Degraded[]) => T | Promise<T>,
  merchantId?: string
): Promise<Step<T>> {
  await mark(jobId, name, "running", {}, merchantId);
  const degraded: Degraded[] = [];
  const value = await fn(degraded);
  await mark(
    jobId,
    name,
    degraded.length ? "degraded" : "done",
    degraded.length
      ? {
          error: degraded
            .map((d) => `${d.unit}: ${d.reason}`)
            .join(" | ")
            .slice(0, 600),
        }
      : {},
    merchantId
  );
  return { value, degraded };
}

const uniqueSlug = (base: string, fallback: string, seen: Set<string>) => {
  let s = slugify(base) || fallback;
  let n = 2;
  const root = s;
  while (seen.has(s)) s = `${root}-${n++}`;
  seen.add(s);
  return s;
};

function keyFromUrl(u: string): string | undefined {
  try {
    const x = new URL(u);
    if (
      !(
        /(?:^|\.)ufs\.sh$/i.test(x.hostname) || x.hostname === "utfs.io"
      )
    )
      return undefined;
    return x.pathname.match(/\/f\/([^/?#]+)/)?.[1];
  } catch {
    return undefined;
  }
}

const chunk = <T,>(a: T[], n: number) =>
  Array.from({ length: Math.ceil(a.length / n) }, (_, i) =>
    a.slice(i * n, i * n + n)
  );

export const { POST } = serve<Input>(
  async (ctx) => {
    const { storeId, intakeId, jobId } = ctx.requestPayload;
    if (ctx.headers.get("x-internal") !== env.QSTASH_INTERNAL_SECRET)
      throw new Error("forbidden");

    const allDegraded: Degraded[] = [];
    const collect = <T,>(s: Step<T>) => {
      allDegraded.push(...s.degraded);
      return s.value;
    };

    const intake = await ctx.run(
      "load",
      async (): Promise<Intake> => {
        const [job] = await db
          .select()
          .from(buildJobs)
          .where(eq(buildJobs.id, jobId))
          .limit(1);
        if (!job || job.storeId !== storeId)
          throw new Error("build job not found for store");
        await db
          .update(buildJobs)
          .set({
            status: "running",
            startedAt: job.startedAt ?? new Date(),
            error: null,
          })
          .where(eq(buildJobs.id, jobId));
        const [i] = await db
          .select()
          .from(intakes)
          .where(eq(intakes.id, intakeId))
          .limit(1);
        if (!i) throw new Error("intake not found");
        return i;
      }
    );

    const merchantRow = await ctx.run("resolve_merchant", async () => {
      const [s] = await db
        .select({ merchantId: stores.merchantId })
        .from(stores)
        .where(eq(stores.id, storeId))
        .limit(1);
      return s?.merchantId ?? null;
    });
    const merchantId = merchantRow ?? undefined;

    const plan = await ctx.run(
      "architect",
      async (): Promise<Plan> => {
        await mark(jobId, "architect", "running", {}, merchantId);
        const p = await architect(intake, storeId);
        await db
          .update(buildJobs)
          .set({ plan: p as unknown as Record<string, unknown> })
          .where(eq(buildJobs.id, jobId));
        await mark(
          jobId,
          "architect",
          "done",
          {
            sections: p.homeOutline.length,
            categories: p.categories.length,
          },
          merchantId
        );
        return p;
      }
    );
    await ctx.sleep("pace-after-architect", 1);

    const batches = productBatches(intake);
    const enriched: ProductOut[] = [];
    for (let k = 0; k < batches.length; k++) {
      const step = await ctx.run<Step<ProductOut[]>>(
        `products_${k}`,
        () =>
          unit(
            jobId,
            `products_${k}`,
            (d) => composeProductsBatch(intake, plan, storeId, batches[k]!, d),
            merchantId
          )
      );
      enriched.push(...collect(step));
    }

    const catalog = await ctx.run(
      "catalog_write",
      async (): Promise<Catalog> => {
        await mark(jobId, "catalog", "running", {}, merchantId);

        const tdb = await getTenantDb(storeId);
        const [existingCatsDb, existingProdsDb] = await Promise.all([
          tdb
            .select({
              id: categories.id,
              slug: categories.slug,
              name: categories.name,
            })
            .from(categories)
            .where(eq(categories.storeId, storeId)),
          tdb
            .select({ slug: products.slug, name: products.name, deletedAt: products.deletedAt })
            .from(products)
            .where(eq(products.storeId, storeId)),
        ]);

        const catSeen = new Set<string>(existingCatsDb.map((c) => c.slug));
        const prodSeen = new Set<string>(existingProdsDb.map((p) => p.slug));
        const planCategories = Array.isArray(plan?.categories)
          ? plan.categories
          : [];

        const catsToInsert = planCategories.filter(
          (c) =>
            c &&
            !existingCatsDb.some(
              (ec) =>
                (ec.name || "").toLowerCase() === (c.name || "").toLowerCase()
            )
        );

        let cats = existingCatsDb.map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.name,
        }));

        if (catsToInsert.length > 0) {
          const newCats = await tdb
            .insert(categories)
            .values(
              catsToInsert.map((c, i) => ({
                storeId,
                name: c.name || `قسم ${i + 1}`,
                slug: uniqueSlug(
                  c.slug || c.name || `cat-${i + 1}`,
                  `cat-${i + 1}`,
                  catSeen
                ),
                sortOrder: existingCatsDb.length + i,
              }))
            )
            .returning({
              id: categories.id,
              slug: categories.slug,
              name: categories.name,
            });
          cats = [...cats, ...newCats];
        }

        const catForProduct = (name: string, e?: ProductOut) => {
          const targetName = (name || "").trim().toLowerCase();
          const planCat = planCategories.find((pc) => {
            if (!pc || !Array.isArray(pc.productNames)) return false;
            return pc.productNames.some(
              (n) =>
                typeof n === "string" &&
                n.trim().toLowerCase() === targetName
            );
          });
          return (
            cats.find(
              (c) =>
                (c.name || "").toLowerCase() ===
                (planCat?.name || "").toLowerCase()
            ) ??
            cats.find((c) => c.slug === slugify(e?.categorySlug ?? "")) ??
            cats[0]
          );
        };

        const intakeProducts = Array.isArray(intake?.products)
          ? intake.products
          : [];
        const anyBestSeller = intakeProducts.some(
          (p) => p && p.bestSeller === true
        );

        // إعادة البناء (أو إعادة محاولة هذه الخطوة) لا تكرر منتجات موجودة بنفس الاسم.
        const liveNames = new Set(
          existingProdsDb
            .filter((p) => !p.deletedAt)
            .map((p) => p.name.trim().toLowerCase())
        );
        const toCreate = intakeProducts
          .map((p, i) => ({ p, i }))
          .filter(({ p, i }) => {
            const e = enriched.find((x) => x && x.index === i);
            const name = (e?.name || p?.name || "").trim().toLowerCase();
            return Boolean(p) && !liveNames.has(name);
          });

        const rows = !toCreate.length ? [] : await tdb
          .insert(products)
          .values(
            toCreate.map(({ p, i }) => {
              const e = enriched.find((x) => x && x.index === i);
              const name = e?.name || p.name || `منتج ${i + 1}`;
              const cat = catForProduct(name, e);
              const gallery = Array.from(
                new Set(
                  [p.imageUrl, ...(p.imageUrls ?? [])].filter(
                    (u): u is string => typeof u === "string" && !!u
                  )
                )
              );
              const badges = Array.from(
                new Set([
                  ...(e?.badges ?? []),
                  ...(p.bestSeller ? ["الأكثر طلباً"] : []),
                ])
              ).slice(0, 2);

              const hasDefs = Boolean(
                Array.isArray(p.optionDefs) &&
                  p.optionDefs.length > 0 &&
                  Array.isArray(p.variants) &&
                  p.variants.length > 0
              );
              const description =
                e?.description || p.description || undefined;
              const simpleStock = p.unlimitedStock
                ? null
                : typeof p.stock === "number"
                  ? p.stock
                  : 20;
              const finalSlug = uniqueSlug(
                name,
                `product-${i + 1}`,
                prodSeen
              );

              return {
                storeId,
                categoryId: cat?.id ?? null,
                name,
                slug: finalSlug,
                shortDescription: e?.shortDescription || undefined,
                description,
                aiDraft: !description,
                pricePiasters: Math.round((Number(p.price) || 0) * 100),
                compareAtPiasters: p.compareAt
                  ? Math.round(Number(p.compareAt) * 100)
                  : null,
                stock: hasDefs ? null : simpleStock,
                trackStock: hasDefs
                  ? Array.isArray(p.variants) &&
                    p.variants.some((v) => v && v.stock !== null)
                  : simpleStock !== null,
                images: gallery.map((url, n) => ({
                  url,
                  alt: n === 0 ? name : `${name} ${n + 1}`,
                  key: keyFromUrl(url),
                })),
                attributes:
                  Array.isArray(p.attributes) && p.attributes.length
                    ? p.attributes
                    : (e?.attributes ?? []),
                optionNames: hasDefs
                  ? p.optionDefs!.map((o) => o.name)
                  : (e?.optionNames ?? []),
                optionMeta: hasDefs ? p.optionDefs! : [],
                tags: e?.tags ?? [],
                badges,
                seoTitle: e?.seoTitle || `${name} بأفضل سعر في مصر`,
                seoDescription:
                  e?.seoDescription ||
                  `اشترِ ${name} الآن مع ميزة الفحص والمعاينة قبل الاستلام والشحن السريع والدفع عند الاستلام.`,
                isFeatured: anyBestSeller
                  ? p.bestSeller === true
                  : i < 4,
                sortOrder: i,
                searchText: buildSearchText([
                  name,
                  p.name,
                  e?.shortDescription,
                  description,
                  p.sellingPoint,
                  ...(e?.tags ?? []),
                ]),
              };
            })
          )
          .returning({
            id: products.id,
            slug: products.slug,
            name: products.name,
            sortOrder: products.sortOrder,
          });

        const variantRows: (typeof productVariants.$inferInsert)[] = [];
        for (const r of rows) {
          const p = intakeProducts[r.sortOrder]!;
          if (
            p &&
            Array.isArray(p.optionDefs) &&
            p.optionDefs.length > 0 &&
            Array.isArray(p.variants) &&
            p.variants.length > 0
          ) {
            for (const v of p.variants.slice(0, 200)) {
              if (!v) continue;
              variantRows.push({
                storeId,
                productId: r.id,
                optionValues: Array.isArray(v.optionValues)
                  ? v.optionValues
                  : [],
                pricePiasters: v.pricePiasters,
                stock: v.stock,
                sku: v.sku ?? null,
                imageUrl: Array.isArray(v.imageUrls)
                  ? v.imageUrls[0] ?? null
                  : null,
                imageUrls: Array.isArray(v.imageUrls)
                  ? v.imageUrls
                  : [],
                isAvailable: v.available ?? true,
              });
            }
          }
        }

        if (variantRows.length > 0) {
          for (const part of chunk(variantRows, 400)) {
            await tdb.insert(productVariants).values(part);
          }
        }

        const pol = (intake?.policies || {}) as {
          shippingFlatEgp?: number;
          shippingZones?: ZoneIn[];
          codFeeEgp?: number;
          deliveryDays?: { min?: number; max?: number };
        };
        const zonesIn = new Map(
          (pol.shippingZones ?? []).map((z) => [z.governorate, z])
        );
        const codExtra = Math.round(Math.max(0, Number(pol.codFeeEgp) || 0) * 100);

        const existingZones = await tdb
          .select()
          .from(shippingZones)
          .where(eq(shippingZones.storeId, storeId));
        if (!existingZones.length) {
          await tdb.insert(shippingZones).values(
            defaultShippingZones().map((z) => {
              const base = { ...z, storeId, codExtraPiasters: codExtra };
              if (zonesIn.size) {
                const c = zonesIn.get(z.governorate);
                return c
                  ? {
                      ...base,
                      feePiasters: Math.round(c.feeEgp * 100),
                      etaMinDays: c.etaMinDays ?? 2,
                      etaMaxDays: c.etaMaxDays ?? 5,
                      isActive: c.active !== false,
                    }
                  : { ...base, isActive: false };
              }
              if (typeof pol.shippingFlatEgp === "number")
                return {
                  ...base,
                  feePiasters: Math.round(pol.shippingFlatEgp * 100),
                  etaMinDays: pol.deliveryDays?.min ?? base.etaMinDays,
                  etaMaxDays: pol.deliveryDays?.max ?? base.etaMaxDays,
                };
              return base;
            })
          );
        }

        // إحصاءات الكتالوج الفعلية: يبني عليها المخرج الفني شكل الصفحة الرئيسية.
        const stats = await catalogStats(storeId);

        await mark(
          jobId,
          "catalog",
          "done",
          {
            products: rows.length,
            categories: cats.length,
            variants: variantRows.length,
          },
          merchantId
        );
        return {
          stats,
          cats: cats.map((c) => ({ slug: c.slug, name: c.name })),
          products: [
            ...existingProdsDb
              .filter((p) => !p.deletedAt)
              .map((p) => ({ slug: p.slug, name: p.name })),
            ...rows.map((r) => ({ slug: r.slug, name: r.name })),
          ],
        };
      }
    );

    // المدير الفني: نظام تصميم خاص بهذا المتجر (ألوان، خطوط، أشكال، CSS).
    const studioDesign = collect(
      await ctx.run("design", () =>
        unit<StudioDesign>(jobId, "design", (d) => designStore(intake, plan, storeId, d), merchantId)
      )
    );

    // كاتب المحتوى: كل نصوص المتجر من حقائقه الفعلية.
    const studioCopy = collect(
      await ctx.run("copy", () =>
        unit<StudioCopy>(jobId, "copy", (d) => writeStore(intake, plan, studioDesign, storeId, d), merchantId)
      )
    );

    const brief = (intake.brief ?? {}) as { features?: Record<string, boolean> };
    const home = composeHome({ copy: studioCopy, design: studioDesign, stats: catalog.stats, features: brief.features });

    const pagesCore = collect(
      await ctx.run("pages_core", () =>
        unit<PagesOut>(
          jobId,
          "pages_core",
          (d) => composePagesGroup(intake, plan, storeId, "core", d),
          merchantId
        )
      )
    );
    const pagesLegal = collect(
      await ctx.run("pages_legal", () =>
        unit<PagesOut>(
          jobId,
          "pages_legal",
          (d) => composePagesGroup(intake, plan, storeId, "legal", d),
          merchantId
        )
      )
    );
    const pages = mergePages(pagesCore, pagesLegal);

    const { blueprint, score } = await ctx.run(
      "assemble_qa",
      async (): Promise<{ blueprint: StoreBlueprint; score: number }> => {
        await mark(jobId, "qa", "running", {}, merchantId);
        let bp = await assemble(
          {
            plan,
            theme: studioDesign.theme,
            studio: { design: studioDesign, copy: studioCopy },
            home,
            pages,
            catalog,
            intake: intake as unknown as Parameters<typeof assemble>[0]["intake"],
          } as unknown as Parameters<typeof assemble>[0],
          storeId
        );
        const report = await runQa(bp, catalog, storeId);
        bp = (await applyFixes(bp, report.fixes)) as StoreBlueprint;
        await db
          .update(buildJobs)
          .set({
            qaReport: report as unknown as Record<string, unknown>,
            status: "qa",
          })
          .where(eq(buildJobs.id, jobId));
        await mark(
          jobId,
          "qa",
          "done",
          { score: report.score },
          merchantId
        );
        return { blueprint: bp, score: report.score };
      }
    );

    await ctx.run("save", async () => {
      // لا يُحفظ Blueprint لا يطابق المخطط: نصلح الأجزاء غير الصالحة حتمياً بدل الفشل.
      const { blueprint: finalBlueprint, report: repair } = repairBlueprint(blueprint, {
        name: plan.brandDirection.name || "متجري",
        storeId,
      });
      if (repair.repaired) {
        await db.insert(systemEvents).values({
          scope: "store",
          storeId,
          actor: "ai",
          level: "warn",
          message: "تم إصلاح Blueprint غير مطابق للمخطط قبل الحفظ",
          data: repair,
        });
      }

      const [cur] = await db
        .select()
        .from(storeBlueprints)
        .where(eq(storeBlueprints.storeId, storeId))
        .limit(1);
      const version = (cur?.version ?? 0) + 1;
      await db
        .insert(storeBlueprints)
        .values({
          storeId,
          version,
          data: finalBlueprint,
          updatedBy: "ai",
        })
        .onConflictDoUpdate({
          target: storeBlueprints.storeId,
          set: {
            version,
            data: finalBlueprint,
            updatedBy: "ai",
            updatedAt: new Date(),
          },
        });
      await db.insert(storeSnapshots).values({
        storeId,
        version,
        data: finalBlueprint,
        label: "بناء المتجر الأولي بالـ AI",
        createdBy: "ai",
      })
      // النسخة نفسها قد تُحفظ عند إعادة الخطوة أو عند أول تعديل لاحق؛ رقم النسخة يحدد محتواها.
      .onConflictDoNothing({ target: [storeSnapshots.storeId, storeSnapshots.version] });

      const deliverAt = new Date(Date.now() + 30_000);
      await transition({
        storeId,
        to: "review",
        from: ["building"],
        actor: "system",
        set: { name: finalBlueprint.brand.name, deliverAt },
        reason: "build_completed",
        data: { jobId, score },
      });

      await db
        .update(buildJobs)
        .set({ status: "done", finishedAt: new Date() })
        .where(eq(buildJobs.id, jobId));
      await cancelJobs(storeId, ["delivery.auto"]);
      await scheduleDelivery(storeId, deliverAt);

      const [storeRecord] = await db
        .select()
        .from(stores)
        .where(eq(stores.id, storeId))
        .limit(1);
      if (storeRecord) {
        const [merchantRecord] = await db
          .select()
          .from(merchants)
          .where(eq(merchants.id, storeRecord.merchantId))
          .limit(1);
        if (merchantRecord?.email) {
          const liveStoreUrl = storeUrl(
            storeRecord.subdomain,
            "/?preview=owner"
          );
          const liveAdminUrl = storeUrl(storeRecord.subdomain, "/admin");
          await sendMerchantStoreReadyEmail({
            merchantEmail: merchantRecord.email,
            storeName: storeRecord.name,
            storeUrl: liveStoreUrl,
            adminUrl: liveAdminUrl,
            storeSubdomain: storeRecord.subdomain,
            storeId: storeRecord.id,
            merchantId: merchantRecord.id,
          }).catch(() => {});
        }
      }

      await notifyAdmin(
        `متجر جاهز للتجربة الفورية: ${storeId} (QA ${score}/100)`,
        { storeId, score }
      );
      await db.insert(systemEvents).values({
        scope: "store",
        storeId,
        actor: "ai",
        level: "info",
        message: `اكتمل بناء المتجر وبدأت التجربة الفورية`,
        data: { score },
      });

      if (merchantId) {
        void emitBuildCompleted(merchantId, {
          jobId,
          storeId,
          subdomain: storeRecord?.subdomain ?? "",
          score,
          completedAt: new Date().toISOString(),
        });
      }
    });
  },
  {
    retries: 2,
    failureFunction: async ({ context, failStatus, failResponse }) => {
      const { jobId, storeId } = context.requestPayload as Input;
      const error = `${failStatus}: ${String(failResponse)}`.slice(0, 1000);
      await db
        .update(buildJobs)
        .set({ status: "failed", error, finishedAt: new Date() })
        .where(eq(buildJobs.id, jobId))
        .catch(() => {});
      await db
        .insert(systemEvents)
        .values({
          scope: "store",
          storeId,
          actor: "system",
          level: "error",
          message: "فشل بناء المتجر",
          data: { jobId, error },
        })
        .catch(() => {});
      await notifyAdmin(
        `فشل بناء متجر ${storeId}: ${String(failResponse)}`.slice(0, 300),
        { storeId, jobId }
      ).catch(() => {});
    },
  }
);