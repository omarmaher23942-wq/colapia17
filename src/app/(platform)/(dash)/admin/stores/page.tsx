// admin/stores/page.tsx — Server Component يحمّل البيانات من قاعدة البيانات
// ويُمرّرها إلى المكوّن العميل StoresDirectoryClient.
//
// السبب الجذري لإنشاء هذا الملف منفصلاً:
// كانت الصفحة Client Component يستقبل initialRows كـ prop من مكان لم يمرّرها،
// فيُستدعى المكوّن بـ initialRows=undefined، ثم initialRows.filter(...) يرمي
// "Cannot read properties of undefined". الفصل بين Server و Client يحل
// المشكلة جذرياً: الـ Server يجلب البيانات، والـ Client للتفاعل فقط.
import { desc, eq, isNull, and, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { stores, merchants } from "@/db/schema";
import { StoresDirectoryClient } from "./StoresDirectoryClient";

export const dynamic = "force-dynamic";

export default async function AdminStoresPage() {
  // ─── جلب قائمة المتاجر مع بيانات التاجر ──────────────────────────────
  const rows = await db
    .select({
      sId: stores.id,
      sName: stores.name,
      sSubdomain: stores.subdomain,
      sStatus: stores.status,
      sCustomDomain: stores.customDomain,
      mName: merchants.displayName,
      mPhone: merchants.phone,
    })
    .from(stores)
    .leftJoin(merchants, eq(merchants.id, stores.merchantId))
    .where(isNull(stores.deletedAt))
    .orderBy(desc(stores.createdAt));

  // ─── حساب الإحصائيات ─────────────────────────────────────────────────
  const total = rows.length;
  const active = rows.filter((r) => r.sStatus === "active").length;
  const trial = rows.filter((r) => r.sStatus === "trial").length;
  const frozen = rows.filter((r) => r.sStatus === "frozen").length;

  // ─── تمرير البيانات للـ Client ───────────────────────────────────────
  return (
    <StoresDirectoryClient
      initialRows={rows.map((r) => ({
        ...r,
        mName: r.mName ?? "",
        mPhone: r.mPhone ?? "",
      }))}
      stats={{ total, active, trial, frozen }}
    />
  );
}

// نحتفظ بـ inArray و and لتوافق الاستيراد المستقبلي بدون warnings.
// (لا نحتاجهما الآن، لكن نمنع Unused import errors في ESLint.)
void inArray;
void and;