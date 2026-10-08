// /api/ownership/export — مشروع التاجر الخاص يسحب منه بيانات متجره بكود الاستلام.
//   GET ?part=manifest           → هوية المتجر، وأعداد الصفوف، وروابط الصور.
//   GET ?table=<name>&offset=<n> → صفحة صفوف من جدول.
import { NextResponse } from "next/server";
import { allow, clientIp } from "@/lib/ratelimit";
import { exportManifest, exportPage, TransferError } from "@/server/ownership/transfer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await allow("transfer", clientIp(req.headers)))) return NextResponse.json({ error: "طلبات كثيرة، انتظر دقيقة" }, { status: 429 });
  const url = new URL(req.url);
  try {
    if (url.searchParams.get("part") === "manifest") return NextResponse.json(await exportManifest(req));
    const table = url.searchParams.get("table") ?? "";
    const offset = Number(url.searchParams.get("offset") ?? 0);
    return NextResponse.json(await exportPage(req, table, offset));
  } catch (e) {
    if (e instanceof TransferError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
