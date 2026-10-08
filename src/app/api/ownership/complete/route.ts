// /api/ownership/complete — مشروع التاجر يؤكد استلام متجره بأعداد الصفوف.
import { NextResponse } from "next/server";
import { allow, clientIp } from "@/lib/ratelimit";
import { completeTransfer, TransferError } from "@/server/ownership/transfer";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!(await allow("transfer", clientIp(req.headers)))) return NextResponse.json({ error: "طلبات كثيرة، انتظر دقيقة" }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { siteUrl?: unknown; stats?: unknown };
  try {
    const r = await completeTransfer(req, body);
    return NextResponse.json(r, { status: r.ok ? 200 : 409 });
  } catch (e) {
    if (e instanceof TransferError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
