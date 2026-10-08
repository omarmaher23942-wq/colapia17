"use server";

// Platform Review moderation & AI Directives
import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { platformReviews, aiDirectives, stores } from "@/db/schema";
import { getPlatformSession } from "@/server/auth";
import { releaseToBuild } from "@/lifecycle/release";
import { cancelJobs, scheduleReview } from "@/lifecycle/scheduler";

// ─── Guard ────────────────────────────────────────────────────────────────
async function requireOwner() {
  const user = await getPlatformSession();
  if (!user) throw new Error("غير مصرح");
  if (user.role === "reviewer") {
    throw new Error("هذه العملية مخصصة لمالك المنصة أو الأدمن فقط");
  }
  return user;
}

// ─── Approval ─────────────────────────────────────────────────────────────
const idField = z.string().uuid();

export async function approveReviewAction(id: string) {
  await requireOwner();
  const parsed = idField.safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "معرّف غير صحيح" };

  const [updated] = await db
    .update(platformReviews)
    .set({ isApproved: true, updatedAt: new Date() })
    .where(eq(platformReviews.id, id))
    .returning({ id: platformReviews.id });

  if (!updated) return { ok: false as const, error: "التقييم غير موجود" };

  revalidatePath("/admin/reviews");
  revalidatePath("/");
  return { ok: true as const };
}

export async function rejectReviewAction(id: string) {
  await requireOwner();
  const parsed = idField.safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "معرّف غير صحيح" };

  const [updated] = await db
    .update(platformReviews)
    .set({ isApproved: false, isFeatured: false, updatedAt: new Date() })
    .where(eq(platformReviews.id, id))
    .returning({ id: platformReviews.id });

  if (!updated) return { ok: false as const, error: "التقييم غير موجود" };

  revalidatePath("/admin/reviews");
  revalidatePath("/");
  return { ok: true as const };
}

export async function toggleFeaturedReviewAction(
  id: string,
  featured: boolean
) {
  await requireOwner();
  const parsed = idField.safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "معرّف غير صحيح" };

  const [updated] = await db
    .update(platformReviews)
    .set({ isFeatured: featured, updatedAt: new Date() })
    .where(eq(platformReviews.id, id))
    .returning({ id: platformReviews.id });

  if (!updated) return { ok: false as const, error: "التقييم غير موجود" };

  revalidatePath("/admin/reviews");
  revalidatePath("/");
  return { ok: true as const };
}

export async function deleteReviewAction(id: string) {
  await requireOwner();
  const parsed = idField.safeParse(id);
  if (!parsed.success) return { ok: false as const, error: "معرّف غير صحيح" };

  await db.delete(platformReviews).where(eq(platformReviews.id, id));
  revalidatePath("/admin/reviews");
  revalidatePath("/");
  return { ok: true as const };
}

// ─── AI Directives (Used by AiInjectionPanel) ─────────────────────────────
export async function addDirectiveAction(input: {
  storeId: string;
  scope: "store" | "product";
  productSourceId?: string | null;
  instruction: string;
  imageUrls: string[];
}): Promise<{ ok: true; id: string } | { error: string }> {
  try {
    const user = await requireOwner();
    const [row] = await db
      .insert(aiDirectives)
      .values({
        storeId: input.storeId,
        scope: input.scope,
        productSourceId: input.productSourceId ?? null,
        instruction: input.instruction,
        imageUrls: input.imageUrls ?? [],
        enabled: true,
        createdBy: user.id,
      })
      .returning({ id: aiDirectives.id });

    if (!row) return { error: "فشل إنشاء الحقل" };
    return { ok: true, id: row.id };
  } catch (err: any) {
    return { error: err?.message || "فشل إنشاء الحقل" };
  }
}

export async function updateDirectiveAction(
  id: string,
  patch: {
    scope?: "store" | "product";
    productSourceId?: string | null;
    instruction?: string;
    imageUrls?: string[];
    enabled?: boolean;
  }
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireOwner();
    await db
      .update(aiDirectives)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(aiDirectives.id, id));
    return { ok: true };
  } catch (err: any) {
    return { error: err?.message || "فشل تحديث الحقل" };
  }
}

export async function deleteDirectiveAction(
  id: string
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireOwner();
    await db.delete(aiDirectives).where(eq(aiDirectives.id, id));
    return { ok: true };
  } catch (err: any) {
    return { error: err?.message || "فشل حذف الحقل" };
  }
}

export async function sendToBuildAction(
  storeId: string
): Promise<{ ok: true } | { error: string }> {
  try {
    const user = await requireOwner();
    const r = await releaseToBuild(storeId, `owner:${user.id}`);
    if (!r.started) {
      return { error: r.reason || "تعذّر بدء البناء" };
    }
    revalidatePath("/admin/pipeline");
    return { ok: true };
  } catch (err: any) {
    return { error: err?.message || "تعذّر بدء البناء" };
  }
}

export async function pauseReviewTimerAction(
  storeId: string
): Promise<{ ok: true } | { error: string }> {
  try {
    await requireOwner();
    await cancelJobs(storeId, ["review.auto_release", "review.reminder"]);
    await db
      .update(stores)
      .set({ reviewDeadlineAt: null, updatedAt: new Date() })
      .where(eq(stores.id, storeId));
    revalidatePath("/admin/pipeline");
    return { ok: true };
  } catch (err: any) {
    return { error: err?.message || "فشل إيقاف المؤقت" };
  }
}

export async function resumeReviewTimerAction(
  storeId: string,
  hours = 12
): Promise<{ ok: true; deadline: string } | { error: string }> {
  try {
    await requireOwner();
    const deadline = new Date(Date.now() + hours * 36e5);
    await db
      .update(stores)
      .set({ reviewDeadlineAt: deadline, updatedAt: new Date() })
      .where(eq(stores.id, storeId));
    await scheduleReview(storeId, deadline);
    revalidatePath("/admin/pipeline");
    return { ok: true, deadline: deadline.toISOString() };
  } catch (err: any) {
    return { error: err?.message || "فشل استئناف المؤقت" };
  }
}