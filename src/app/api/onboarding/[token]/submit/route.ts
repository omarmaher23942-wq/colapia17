import { z } from "zod";
import { NextResponse } from "next/server";
import { clientIp, json, rateLimit, requireActiveSession } from "@/onboarding/guard";
import { submitOnboarding } from "@/onboarding/submit";

export const maxDuration = 45;
export const dynamic = "force-dynamic";

const body = z.object({
  draftVersion: z.number().int().min(0).default(0),
  data: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;

    if (!(await rateLimit(`onb:ip:${clientIp(req)}`, 300, 60))) {
      return json({ error: "rate_limited", message: "محاولات كثيرة، يرجى الانتظار لحظة." }, 429);
    }

    const g = await requireActiveSession(token);
    if (!g.ok) return g.res;

    const rawJson = await req.json().catch(() => ({}));
    const parsed = body.safeParse(rawJson);
    const clientVersion = parsed.success ? parsed.data.draftVersion : 0;

    const r = await submitOnboarding(g.session, clientVersion);

    if (r.ok) return json(r);

    if (r.error === "invalid") {
      return json(
        {
          ...r,
          message: "في بيانات ناقصة، راجع الخطوات المحددة.",
        },
        422
      );
    }

    return json(r, 422);
  } catch (e) {
    console.error("[onboarding/submit] Unhandled error:", e);
    return NextResponse.json(
      {
        error: "server_error",
        message: "حدث خطأ أثناء حفظ المتجر، يرجى المحاولة ثانية.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}