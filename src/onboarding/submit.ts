import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { buildJobs, conversations, intakes, merchants, onboardingSessions, stores } from "@/db/schema";
import { redis } from "@/lib/redis";
import { stripEmoji, stripEmojiDeep } from "@/lib/emoji";
import { notifyAdmin } from "@/ai/lifecycle/notify";
import { recordEvent } from "@/lifecycle/machine";
import { releaseToBuild } from "@/lifecycle/release";
import { onboardingSubmissionSchema } from "./schema";
import { submissionToIntake } from "./to-intake";
import { richness } from "./richness";
import { checkSubdomain, releaseSubdomain } from "./subdomain";
import { reservePreview } from "./preview-guard";
import type { SessionRow } from "./sessions";

export type SubmitResult =
  | { ok: true; storeId: string; subdomain: string; reviewDeadlineAt: string | null; alreadySubmitted?: boolean; retriggered?: boolean }
  | { ok: false; error: "invalid"; firstStep: string; issues: { path: string; message: string }[] }
  | { ok: false; error: "subdomain"; status: "invalid" | "reserved" | "taken"; message: string }
  | { ok: false; error: "limited"; reason: "merchant" | "ip" | "phone" | "daily"; message: string }
  | { ok: false; error: "conflict"; draftVersion: number }
  | { ok: false; error: "not_found"; message: string };

const STEPS = new Set(["store", "products", "launch"]);

/**
 * حالات المتجر التي تُعتبر "جاهزة" فعلاً ولا تحتاج إعادة بناء.
 * أي حالة أخرى (intake / building / pending_review) تعني أن البناء لم يكتمل بنجاح.
 */
const READY_STATUSES = new Set(["review", "trial", "active"]);

export async function submitOnboarding(
  session: SessionRow,
  _draftVersion: number,
  clientData?: Record<string, unknown>,
  ctx: { ip?: string } = {}
): Promise<SubmitResult> {
  // ────────────────────────────────────────────────────────────────────────────
  // المسار الاستثنائي: المستخدم عاد بعد submit سابق.
  //  - إن كان المتجر مبنياً بنجاح: أرجع بياناته مباشرة (alreadySubmitted).
  //  - إن كان البناء فاشلاً أو لم يبدأ: أعد تشغيل الـ build (retriggered).
  //  - إن كان البناء جارياً الآن: أخبره بأنه قيد البناء.
  // ────────────────────────────────────────────────────────────────────────────
  if (session.status === "submitted" && session.storeId) {
    const [existing] = await db
      .select()
      .from(stores)
      .where(eq(stores.id, session.storeId))
      .limit(1);

    if (existing) {
      const [latestJob] = await db
        .select()
        .from(buildJobs)
        .where(eq(buildJobs.storeId, existing.id))
        .orderBy(desc(buildJobs.createdAt))
        .limit(1);

      const buildFailed = latestJob?.status === "failed" || existing.status === "intake";
      const buildRunning =
        latestJob?.status === "running" ||
        latestJob?.status === "queued" ||
        existing.status === "building";
      const isReady = READY_STATUSES.has(existing.status);

      if (isReady) {
        return {
          ok: true,
          storeId: existing.id,
          subdomain: existing.subdomain,
          reviewDeadlineAt: null,
          alreadySubmitted: true,
        };
      }

      if (buildFailed) {
        // إعادة تشغيل البناء من نفس الـ intake الموجود
        await db
          .update(buildJobs)
          .set({ status: "queued", error: null, startedAt: null, finishedAt: null })
          .where(eq(buildJobs.id, latestJob!.id))
          .catch(() => {});

        try {
          await releaseToBuild(existing.id, "onboarding_retry_after_failure");
        } catch (err) {
          console.error("[submit] Retry build trigger failed:", err);
        }

        return {
          ok: true,
          storeId: existing.id,
          subdomain: existing.subdomain,
          reviewDeadlineAt: null,
          retriggered: true,
        };
      }

      if (buildRunning) {
        return {
          ok: true,
          storeId: existing.id,
          subdomain: existing.subdomain,
          reviewDeadlineAt: null,
          alreadySubmitted: true,
        };
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // المسار الطبيعي: أول إرسال
  // ────────────────────────────────────────────────────────────────────────────
  const mergedDraft = {
    schemaVersion: 1,
    ...(session.draft || {}),
    ...(clientData || {}),
  };

  const parsed = onboardingSubmissionSchema.safeParse(stripEmojiDeep(mergedDraft) as unknown);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    const head = String(parsed.error.issues[0]?.path[0] ?? "store");
    return {
      ok: false,
      error: "invalid",
      firstStep: STEPS.has(head) ? head : "store",
      issues,
    };
  }

  const submission = parsed.data;
  let sub = submission.store.desiredSubdomain.trim().toLowerCase();

  const chk = await checkSubdomain(sub, session.id);
  if (chk !== "ok") {
    sub = `${sub}-${Math.floor(Math.random() * 89 + 10)}`;
  }

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, session.conversationId))
    .limit(1);
  if (!conv) return { ok: false, error: "not_found", message: "المحادثة غير موجودة." };

  // حماية المعاينة المجانية من الإساءة (تكلفة ذكاء اصطناعي حقيقية لكل متجر).
  const gate = await reservePreview({ merchantId: conv.merchantId, ip: ctx.ip ?? "unknown", phone: submission.store.phone });
  if (!gate.ok) return { ok: false, error: "limited", reason: gate.reason, message: gate.message };

  const now = new Date();
  const storeId = randomUUID();
  const merchantId = conv.merchantId ?? randomUUID();
  const payload = submissionToIntake(submission);
  const score = richness(submission);
  const storeName = stripEmoji(submission.store.storeName).trim() || "متجري";
  // اسم صاحب المتجر من الاستمارة؛ إن غاب لا نمسح اسمه الحقيقي (من Google) بقيمة عامة.
  const ownerName = stripEmoji(submission.store.ownerName ?? "").trim();

  const intakeVals = {
    storeId,
    brief: payload.brief,
    products: payload.products,
    policies: payload.policies,
    assets: payload.assets,
    completeness: score,
    finalizedAt: now,
    updatedAt: now,
  };

  const merchantOp = conv.merchantId
    ? db
        .update(merchants)
        .set({
          ...(ownerName ? { displayName: ownerName } : {}),
          phone: submission.store.phone,
          updatedAt: now,
        })
        .where(eq(merchants.id, merchantId))
    : db.insert(merchants).values({
        id: merchantId,
        displayName: ownerName || storeName,
        phone: submission.store.phone,
        ...(conv.channel === "messenger"
          ? { messengerPsid: conv.externalId }
          : { instagramIgsid: conv.externalId }),
      });

  try {
    await db.batch([
      merchantOp,
      db.insert(stores).values({
        id: storeId,
        merchantId,
        subdomain: sub,
        name: storeName,
        status: "building",
        buildStartedAt: now,
        submittedAt: now,
      }),
      db
        .insert(intakes)
        .values({ conversationId: conv.id, ...intakeVals })
        .onConflictDoUpdate({
          target: intakes.storeId,
          set: intakeVals,
        }),
      db
        .update(onboardingSessions)
        .set({
          status: "submitted",
          submission,
          submittedAt: now,
          storeId,
          updatedAt: now,
        })
        .where(
          and(
            eq(onboardingSessions.id, session.id),
            inArray(onboardingSessions.status, ["issued", "draft"])
          )
        ),
      db
        .update(conversations)
        .set({ storeId, merchantId, stage: "building", updatedAt: now })
        .where(eq(conversations.id, conv.id)),
    ] as any);
  } catch (e: any) {
    if (e?.code === "23505") {
      const [again] = await db
        .select()
        .from(onboardingSessions)
        .where(eq(onboardingSessions.id, session.id))
        .limit(1);
      if (again?.status === "submitted" && again.storeId) {
        return {
          ok: true,
          storeId: again.storeId,
          subdomain: sub,
          reviewDeadlineAt: null,
          alreadySubmitted: true,
        };
      }
    }
    throw e;
  }

  await releaseSubdomain(sub, session.id).catch(() => {});
  await redis.del(`subsess:${session.id}`).catch(() => {});

  const productsCount = Array.isArray(submission.products)
    ? submission.products.length
    : submission.products.products.length;

  await recordEvent({
    storeId,
    storeRef: sub,
    conversationId: conv.id,
    type: "form.submitted_and_building",
    to: "building",
    actor: `merchant:${merchantId}`,
    data: { sessionId: session.id, richness: score, products: productsCount },
  });

  // إطلاق خط إنتاج الـ AI فوراً للبناء
  try {
    await releaseToBuild(storeId, "onboarding_auto_trigger");
  } catch (err) {
    console.error("[submit] Immediate build trigger failed:", err);
  }

  await notifyAdmin(
    `استمارة جديدة: ${sub} (${storeName}) — بدأ البناء الفوري بالـ AI 🚀`,
    { storeId, score }
  ).catch(() => {});

  return { ok: true, storeId, subdomain: sub, reviewDeadlineAt: null };
}