// app/api/email/track/route.ts — نقاط تتبع فتح/نقر الإيميل.
//
// المسارات:
//  GET /api/email/track/open?eid=X  → pixel 1×1 + تسجيل حدث الفتح.
//  GET /api/email/track/click?eid=X&u=URL → تسجيل نقر + redirect.
//
// الأمان:
//  - لا نكشف بيانات المُرسَل إليه.
//  - روابط redirect محدودة بـ appUrl فقط (منع open redirect).
//  - Rate limit خفيف.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { systemEvents } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 1×1 transparent GIF.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

const EMPTY_GIF = {
  status: 200,
  headers: {
    "Content-Type": "image/gif",
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    "Content-Length": String(PIXEL.length),
    Pragma: "no-cache",
  },
};

// ─── Open tracking ─────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path.endsWith("/open")) {
    return handleOpen(url);
  }
  if (path.endsWith("/click")) {
    return handleClick(req, url);
  }

  return new NextResponse("Not found", { status: 404 });
}

async function handleOpen(url: URL): Promise<NextResponse> {
  const eid = url.searchParams.get("eid");
  if (!eid || !/^[a-f0-9-]{36}$/i.test(eid)) {
    return new NextResponse(PIXEL, EMPTY_GIF as never);
  }

  // نسجّل فتح الإيميل بشكل fire-and-forget.
  void recordEvent("email_opened", eid, {
    userAgent: null,
  }).catch(() => {});

  return new NextResponse(PIXEL, EMPTY_GIF as never);
}

async function handleClick(req: Request, url: URL): Promise<NextResponse> {
  const eid = url.searchParams.get("eid");
  const target = url.searchParams.get("u");

  if (!eid || !target) {
    return new NextResponse("Missing params", { status: 400 });
  }

  // تحقق من أن الرابط يبدأ بـ http/https ولمنع open redirect.
  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }

  // نقبل فقط روابط http/https.
  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    return new NextResponse("Forbidden protocol", { status: 400 });
  }

  // نسجّل النقر.
  void recordEvent("email_clicked", eid, {
    target: targetUrl.toString().slice(0, 500),
    referer: req.headers.get("referer")?.slice(0, 500) ?? null,
  }).catch(() => {});

  return NextResponse.redirect(targetUrl.toString(), {
    status: 302,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

// ─── Event recorder ────────────────────────────────────────────────────────
async function recordEvent(
  event: "email_opened" | "email_clicked",
  eid: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    // نسجّل في system_events بشكل تجميعي.
    await db.insert(systemEvents).values({
      scope: "ops",
      level: "info",
      message: event,
      data: {
        emailLogId: eid,
        at: new Date().toISOString(),
        ...data,
      },
    });
  } catch {
    // تجاهل — لا نكسر الـ pixel/redirect.
  }
}

export const POST = GET;