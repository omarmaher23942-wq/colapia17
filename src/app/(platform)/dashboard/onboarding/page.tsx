// dashboard/onboarding/page.tsx — بوابة دخول الاستمارة (v3).
//
// التعديلات الجذرية (موجة 3):
//  1) unstable_rethrow في كل catch (Next 15 redirect pattern).
//  2) Logging منظّم لكل قرار.
//  3) إعادة استخدام المحادثة الموجودة أو إنشاء واحدة.
//  4) إصدار جلسة onboarding مع resume.
import { redirect, unstable_rethrow } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { getMerchantSession } from "@/server/auth";
import { issueOnboardingSession } from "@/onboarding/sessions";
import { readRequestId } from "@/lib/correlation";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

export default async function OnboardingEntryPage() {
  const reqId = await readRequestId();
  const session = await getMerchantSession();

  if (!session) {
    log.info("onboarding", "entry_unauthenticated", { reqId });
    redirect(
      `/login?redirect=${encodeURIComponent("/dashboard/onboarding")}&reason=requires_login`
    );
  }

  if (session.store) {
    log.info("onboarding", "entry_already_has_store", {
      reqId,
      merchantId: session.merchant.id,
      storeId: session.store.id,
    });
    redirect("/dashboard?onboarding=already_completed");
  }

  let conversationId: string | null = null;
  try {
    const [existing] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.merchantId, session.merchant.id))
      .orderBy(desc(conversations.updatedAt))
      .limit(1);

    if (existing) {
      conversationId = existing.id;
      log.info("onboarding", "entry_conversation_found", {
        reqId,
        merchantId: session.merchant.id,
        conversationId: existing.id,
      });
    } else {
      const webGuestId = `merchant_${session.merchant.id.slice(0, 16)}`;
      const [created] = await db
        .insert(conversations)
        .values({
          channel: "messenger",
          externalId: webGuestId,
          merchantId: session.merchant.id,
          profileName: session.merchant.displayName,
          stage: "link_sent",
        })
        .returning({ id: conversations.id });
      conversationId = created?.id ?? null;
      if (created) {
        log.info("onboarding", "entry_conversation_created", {
          reqId,
          merchantId: session.merchant.id,
          conversationId: created.id,
        });
      }
    }
  } catch (err) {
    unstable_rethrow(err);
    log.error(
      "onboarding",
      "entry_conversation_query_failed",
      { reqId, merchantId: session.merchant.id },
      "فشل الوصول إلى المحادثات",
      err
    );
    redirect("/dashboard?onboarding=error&reason=conversation_query");
  }

  if (!conversationId) {
    log.error("onboarding", "entry_no_conversation", {
      reqId,
      merchantId: session.merchant.id,
    });
    redirect("/dashboard?onboarding=error&reason=conversation_create");
  }

  let issuedUrl: string | null = null;
  try {
    const result = await issueOnboardingSession(conversationId);
    issuedUrl = result.url;
    log.info("onboarding", "entry_redirect", {
      reqId,
      merchantId: session.merchant.id,
      conversationId,
      sessionId: result.sessionId,
      resumed: result.resumed,
    });
  } catch (err) {
    unstable_rethrow(err);
    log.error(
      "onboarding",
      "entry_issue_failed",
      { reqId, merchantId: session.merchant.id, conversationId },
      "فشل إصدار جلسة الاستمارة",
      err
    );
    redirect("/dashboard?onboarding=error&reason=session_issue");
  }

  redirect(issuedUrl);
}