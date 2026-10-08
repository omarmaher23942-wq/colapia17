import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { onboardingSessions } from "@/db/schema";
import { DRAFT_MAX_BYTES, onboardingDraftSchema } from "@/onboarding/schema";
import { clientIp, json, rateLimit, requireActiveSession } from "@/onboarding/guard";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

// السماح بالحقول الخاصة بالهيكل الجديد مع الحفاظ على الحقول السابقة للأمان
const ALLOWED_KEYS = new Set([
  "store",
  "products",
  "launch",
  "identity",
  "contact",
  "commerce",
  "visual",
  "content",
  "consent",
]);

const ENVELOPE_SLACK = 2_000;

export async function PUT(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;

    if (!(await rateLimit(`onb:ip:${clientIp(req)}`, 240, 60))) {
      return json({ error: "rate_limited", message: "محاولات كثيرة، يرجى الانتظار لحظة." }, 429);
    }

    const g = await requireActiveSession(token);
    if (!g.ok) return g.res;
    const { session } = g;

    if (!(await rateLimit(`onb:draft:${session.id}`, 60, 60))) {
      return json({ error: "rate_limited", message: "محاولات كثيرة، يرجى الانتظار لحظة." }, 429);
    }

    if (Number(req.headers.get("content-length") ?? 0) > DRAFT_MAX_BYTES + ENVELOPE_SLACK) {
      return json({ error: "too_large", message: "حجم البيانات كبير جداً." }, 413);
    }

    const raw = await req.text();
    if (Buffer.byteLength(raw) > DRAFT_MAX_BYTES + ENVELOPE_SLACK) {
      return json({ error: "too_large", message: "حجم البيانات كبير جداً." }, 413);
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: "bad_json", message: "بيانات غير صالحة." }, 400);
    }

    const parsed = onboardingDraftSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "invalid", message: "بيانات غير صالحة." }, 400);
    }

    const { draftVersion, step, data } = parsed.data;
    const clean = Object.fromEntries(
      Object.entries(data).filter(([k]) => ALLOWED_KEYS.has(k))
    );
    const now = new Date();

    const [row] = await db
      .update(onboardingSessions)
      .set({
        draft: clean,
        draftVersion: sql`${onboardingSessions.draftVersion} + 1`,
        status: "draft",
        lastSeenAt: now,
        updatedAt: now,
        ...(step ? { lastStep: step } : {}),
      })
      .where(
        and(
          eq(onboardingSessions.id, session.id),
          eq(onboardingSessions.draftVersion, draftVersion),
          inArray(onboardingSessions.status, ["issued", "draft"]),
          gt(onboardingSessions.expiresAt, now)
        )
      )
      .returning({ draftVersion: onboardingSessions.draftVersion });

    if (row) {
      return json({ ok: true, draftVersion: row.draftVersion, savedAt: now.toISOString() });
    }

    const again = await requireActiveSession(token);
    if (!again.ok) return again.res;
    return json(
      { error: "conflict", draftVersion: again.session.draftVersion, draft: again.session.draft },
      409
    );
  } catch (e) {
    console.error("[onboarding/draft] unhandled error:", e);
    const msg = String((e as { message?: unknown })?.message ?? e).slice(0, 300);
    return NextResponse.json(
      {
        error: "server_error",
        message: "تعذّر الحفظ مؤقتاً. هيعيد المحاولة تلقائياً.",
        debug: process.env.NODE_ENV === "production" ? undefined : msg,
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export const POST = PUT;