// GET /api/health — فحص بسيط لتشغيل الموقع (لا يكشف أسراراً ولا بيانات).
import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, database: isDatabaseConfigured() }, { headers: { "cache-control": "no-store" } });
}
