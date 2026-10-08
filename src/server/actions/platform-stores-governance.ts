"use server";

import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { getTenantDb, groupStoresByTenantDb } from "@/db/tenant";
import {
  stores,
  merchants,
  orders,
  abandonedCarts,
  products,
  storeBlueprints,
  storeSnapshots,
  systemEvents,
} from "@/db/schema";
import { getPlatformSession } from "@/server/auth";
import { invalidateStoreCache } from "@/lib/tenant";
import { transition } from "@/lifecycle/machine";
import type { StoreBlueprint } from "@/blueprint/schema";

async function requireOwner() {
  const u = await getPlatformSession();
  if (!u || u.role === "reviewer") throw new Error("غير مصرح");
  return u;
}

export async function calculateStoreRiskAction(storeId: string) {
  try {
    await requireOwner();

    const [storeData] = await db
      .select({
        s: stores,
        m: merchants,
        bp: storeBlueprints.data,
      })
      .from(stores)
      .leftJoin(merchants, eq(merchants.id, stores.merchantId))
      .leftJoin(storeBlueprints, eq(storeBlueprints.storeId, stores.id))
      .where(eq(stores.id, storeId))
      .limit(1);

    if (!storeData) throw new Error("المتجر غير موجود");

    const tdb = await getTenantDb(storeId);
    const [prodCount] = await tdb
      .select({ c: sql<number>`count(*)`.mapWith(Number) })
      .from(products)
      .where(and(eq(products.storeId, storeId), isNull(products.deletedAt)));
    const productCount = prodCount?.c ?? 0;

    const [cartStats] = await db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        recovered: sql<number>`count(*) filter (where recovered_order_id is not null)`.mapWith(
          Number
        ),
      })
      .from(abandonedCarts)
      .where(eq(abandonedCarts.storeId, storeId));
    const cartTotal = cartStats?.total ?? 0;
    const cartRecovered = cartStats?.recovered ?? 0;

    let riskScore = 0;
    const factors: string[] = [];
    const recommendations: string[] = [];

    const daysSinceLogin = storeData.m?.lastLoginAt
      ? Math.floor(
          (Date.now() - storeData.m.lastLoginAt.getTime()) / 86400000
        )
      : 30;

    if (daysSinceLogin > 14) {
      riskScore += 40;
      factors.push(`لم يسجل دخول منذ ${daysSinceLogin} يوماً`);
      recommendations.push(
        "أرسل رسالة واتساب لتفقد حالة التاجر وتقديم المساعدة."
      );
    } else if (daysSinceLogin > 7) {
      riskScore += 20;
      factors.push(`لم يسجل دخول منذ ${daysSinceLogin} أيام`);
    }

    if (productCount === 0) {
      riskScore += 30;
      factors.push("لا يوجد أي منتجات بالمتجر");
      recommendations.push(
        "اقترح على التاجر استخدام ميزة 'استيراد المنتجات الجاهزة'."
      );
    } else if (productCount < 3) {
      riskScore += 15;
      factors.push("عدد المنتجات قليل جداً (< 3)");
    }

    if (cartStats && cartTotal > 5 && cartRecovered === 0) {
      riskScore += 20;
      factors.push("سلات متروكة غير معالجة");
      recommendations.push(
        "ذكّر التاجر باستخدام ميزة 'صائد السلات' لمراسلة العملاء."
      );
    }

    const bp = storeData.bp as StoreBlueprint | null;
    if (bp && !bp.channels.whatsappNumber && !bp.channels.phone) {
      riskScore += 10;
      factors.push("لا توجد وسائل تواصل للعملاء");
      recommendations.push(
        "اطلب من التاجر إضافة رقم واتساب لزيادة ثقة المشترين."
      );
    }

    riskScore = Math.min(100, riskScore);

    await db.insert(systemEvents).values({
      scope: "admin",
      actor: "system",
      storeId,
      message: `تم فحص مخاطر المتجر: ${riskScore}%`,
      data: { riskScore, factors },
    });

    return {
      ok: true,
      data: {
        riskScore,
        factors,
        recommendations,
        merchantPhone: storeData.m?.phone,
      },
    };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "فشل حساب المخاطر" };
  }
}

export async function compareStoresAction(storeIds: string[]) {
  try {
    await requireOwner();
    if (storeIds.length < 2 || storeIds.length > 4) {
      throw new Error("يجب اختيار من 2 إلى 4 متاجر للمقارنة");
    }

    const storesData = await db
      .select({
        id: stores.id,
        name: stores.name,
        subdomain: stores.subdomain,
        status: stores.status,
        merchantName: merchants.displayName,
        lastLogin: merchants.lastLoginAt,
        bp: storeBlueprints.data,
      })
      .from(stores)
      .leftJoin(merchants, eq(merchants.id, stores.merchantId))
      .leftJoin(storeBlueprints, eq(storeBlueprints.storeId, stores.id))
      .where(inArray(stores.id, storeIds));

    const statsData = (
      await Promise.all(
        [...(await groupStoresByTenantDb(storeIds))].map(([tdb, ids]) =>
          tdb
            .select({
              storeId: orders.storeId,
              gmv: sql<number>`coalesce(sum(total_piasters), 0)`.mapWith(Number),
              ordersCount: sql<number>`count(*)`.mapWith(Number),
            })
            .from(orders)
            .where(inArray(orders.storeId, ids))
            .groupBy(orders.storeId)
        )
      )
    ).flat();

    const result = storesData.map((s) => {
      const stat = statsData.find((st) => st.storeId === s.id) || {
        gmv: 0,
        ordersCount: 0,
      };
      const bp = s.bp as StoreBlueprint | null;
      return {
        id: s.id,
        name: s.name,
        subdomain: s.subdomain,
        status: s.status,
        merchantName: s.merchantName,
        lastLogin: s.lastLogin,
        gmv: stat.gmv,
        ordersCount: stat.ordersCount,
        aov:
          stat.ordersCount > 0
            ? Math.round(stat.gmv / stat.ordersCount)
            : 0,
        primaryColor: bp?.theme.palette.primary ?? "#000000",
        font: bp?.theme.fonts.heading ?? "cairo",
        sectionsCount: bp?.home.length ?? 0,
        codEnabled: bp?.payments.cod.enabled ?? false,
        vCashEnabled: bp?.payments.vodafoneCash.enabled ?? false,
        instapayEnabled: bp?.payments.instapay.enabled ?? false,
      };
    });

    return { ok: true, data: result };
  } catch (e) {
    unstable_rethrow(e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "فشل المقارنة",
    };
  }
}

export async function rollbackSnapshotAction(
  storeId: string,
  snapshotId: string
) {
  try {
    const u = await requireOwner();

    const [targetSnap] = await db
      .select()
      .from(storeSnapshots)
      .where(
        and(
          eq(storeSnapshots.id, snapshotId),
          eq(storeSnapshots.storeId, storeId)
        )
      )
      .limit(1);

    if (!targetSnap) throw new Error("النسخة غير موجودة");

    const [currentBp] = await db
      .select()
      .from(storeBlueprints)
      .where(eq(storeBlueprints.storeId, storeId))
      .limit(1);

    if (currentBp) {
      await db.insert(storeSnapshots).values({
        storeId,
        version: currentBp.version,
        data: currentBp.data,
        label: "حفظ تلقائي قبل الاسترجاع (Rollback)",
        createdBy: `owner:${u.id}`,
      });
    }

    const newVersion = (currentBp?.version ?? 0) + 1;

    await db
      .insert(storeBlueprints)
      .values({
        storeId,
        version: newVersion,
        data: targetSnap.data,
        updatedBy: `owner:${u.id}`,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: storeBlueprints.storeId,
        set: {
          version: newVersion,
          data: targetSnap.data,
          updatedBy: `owner:${u.id}`,
          updatedAt: new Date(),
        },
      });

    const [s] = await db
      .select()
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    if (s) await invalidateStoreCache(s);

    await db.insert(systemEvents).values({
      scope: "admin",
      actor: `owner:${u.id}`,
      storeId,
      message: `تم استرجاع المتجر للنسخة v${targetSnap.version}`,
    });

    revalidatePath(`/admin/stores/${storeId}`);
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "فشل استرجاع النسخة" };
  }
}

export async function bindCustomDomainAction(
  storeId: string,
  customDomain: string
) {
  try {
    const u = await requireOwner();
    const domain = customDomain.trim().toLowerCase();

    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(domain)) {
      throw new Error("صيغة الدومين غير صحيحة");
    }

    const [existing] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.customDomain, domain))
      .limit(1);

    if (existing && existing.id !== storeId) {
      throw new Error("هذا الدومين مربوط بمتجر آخر بالفعل");
    }

    await db
      .update(stores)
      .set({ customDomain: domain, updatedAt: new Date() })
      .where(eq(stores.id, storeId));

    const [s] = await db
      .select()
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    if (s) await invalidateStoreCache(s);

    await db.insert(systemEvents).values({
      scope: "admin",
      actor: `owner:${u.id}`,
      storeId,
      message: `تم ربط الدومين المخصص: ${domain}`,
    });

    revalidatePath(`/admin/stores/${storeId}`);
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "فشل ربط الدومين",
    };
  }
}

export async function bulkStoreGovernanceAction(
  storeIds: string[],
  action: "freeze" | "unfreeze" | "activate_lifetime"
) {
  try {
    const u = await requireOwner();
    if (!storeIds.length) return { ok: true };

    let successCount = 0;
    for (const id of storeIds) {
      try {
        if (action === "freeze") {
          await transition({
            storeId: id,
            to: "frozen",
            actor: `owner:${u.id}`,
            reason: "bulk_freeze",
          });
        } else if (action === "unfreeze") {
          await transition({
            storeId: id,
            to: "trial",
            from: ["frozen"],
            actor: `owner:${u.id}`,
            reason: "bulk_unfreeze",
          });
        } else if (action === "activate_lifetime") {
          await transition({
            storeId: id,
            to: "active",
            actor: `owner:${u.id}`,
            reason: "bulk_activate",
          });
        }
        successCount++;
      } catch {
        // Continue with others
      }
    }

    revalidatePath("/admin/stores");
    return { ok: true, successCount };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: "فشل الإجراء الجماعي" };
  }
}