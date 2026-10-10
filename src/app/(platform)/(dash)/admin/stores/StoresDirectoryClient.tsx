"use client";

// StoresDirectoryClient.tsx — عرض وإدارة قائمة المتاجر (عميل).
// يتلقى كل البيانات كـ props من Server Component.
// يدعم: بحث، فلترة، تحديد جماعي، وإجراءات حوكمة.
import { useState } from "react";
import Link from "next/link";
import {
  Store,
  Search,
  ShieldAlert,
  Globe,
} from "lucide-react";
import { storeUrl, cn } from "@/lib/utils";
import { StoreComparisonMatrix } from "@/components/platform/StoreComparisonMatrix";
import { bulkStoreGovernanceAction } from "@/server/actions/platform-stores-governance";
import { toast } from "sonner";

type Row = {
  sId: string;
  sName: string;
  sSubdomain: string;
  sStatus: string;
  sCustomDomain: string | null;
  mName: string;
  mPhone: string;
};

type Stats = {
  total: number;
  active: number;
  trial: number;
  frozen: number;
};

export function StoresDirectoryClient({
  initialRows,
  stats,
}: {
  initialRows: Row[];
  stats: Stats;
}) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const rows = Array.isArray(initialRows) ? initialRows : [];

  const filteredRows = rows.filter((r) => {
    const matchQ = q
      ? r.sName.toLowerCase().includes(q.toLowerCase()) ||
        r.sSubdomain.toLowerCase().includes(q.toLowerCase()) ||
        (r.mName && r.mName.toLowerCase().includes(q.toLowerCase()))
      : true;
    const matchS = statusFilter ? r.sStatus === statusFilter : true;
    return matchQ && matchS;
  });

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    if (selected.size === filteredRows.length) setSelected(new Set());
    else setSelected(new Set(filteredRows.map((r) => r.sId)));
  };

  const doBulk = async (action: "freeze" | "activate_lifetime") => {
    setLoading(true);
    try {
      const res = await bulkStoreGovernanceAction(Array.from(selected), action);
      if (res.ok) {
        toast.success(`تم تنفيذ الإجراء على ${res.successCount} متجر`);
        setSelected(new Set());
        window.location.reload();
      } else {
        toast.error(res.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 bg-[#07091a] text-[#eaf0ff]" dir="rtl">
      {/* Top Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-[#0b0f2a] p-4">
          <p className="text-xs text-slate-400">إجمالي المتاجر</p>
          <p className="mt-1 text-2xl font-black text-white">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-xs text-emerald-300">متاجر نشطة (Active)</p>
          <p className="mt-1 text-2xl font-black text-emerald-400">
            {stats.active}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-xs text-amber-300">فترة التجربة (Trial)</p>
          <p className="mt-1 text-2xl font-black text-amber-400">
            {stats.trial}
          </p>
        </div>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
          <p className="text-xs text-rose-300">معرضة للإلغاء (Frozen)</p>
          <p className="mt-1 text-2xl font-black text-rose-400">
            {stats.frozen}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Store className="size-6 text-[#8fa8ff]" />
            دليل المتاجر الشامل
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالاسم أو الرابط..."
              className="h-10 w-64 rounded-xl border border-white/10 bg-[#0e1424] px-3 pe-9 text-xs text-white outline-none focus:border-[#8fa8ff]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-white/10 bg-[#0e1424] px-3 text-xs text-white outline-none focus:border-[#8fa8ff]"
          >
            <option value="">كل الحالات</option>
            <option value="active">مفعّل</option>
            <option value="trial">تجربة نشطة</option>
            <option value="frozen">مجمّد</option>
            <option value="review">بانتظار التسليم</option>
          </select>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between bg-[#6f86ff]/10 border border-[#8fa8ff]/30 p-3 rounded-2xl">
          <span className="text-xs font-bold text-[#8fa8ff]">
            {selected.size} متاجر محددة
          </span>
          <div className="flex gap-2">
            <StoreComparisonMatrix
              selectedIds={Array.from(selected)}
              onClear={() => setSelected(new Set())}
            />
            <button
              disabled={loading}
              onClick={() => doBulk("freeze")}
              className="rounded-lg bg-rose-500/20 text-rose-300 px-3 py-1.5 text-xs font-bold hover:bg-rose-500/30 disabled:opacity-50"
            >
              تجميد جماعي
            </button>
            <button
              disabled={loading}
              onClick={() => doBulk("activate_lifetime")}
              className="rounded-lg bg-emerald-500/20 text-emerald-300 px-3 py-1.5 text-xs font-bold hover:bg-emerald-500/30 disabled:opacity-50"
            >
              تفعيل دائم جماعي
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-3xl border border-white/10 bg-[#0e1424]">
        <table className="w-full text-xs text-start">
          <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400 font-bold">
            <tr>
              <th className="w-10 p-4 text-start">
                <input
                  type="checkbox"
                  checked={
                    selected.size === filteredRows.length &&
                    filteredRows.length > 0
                  }
                  onChange={toggleAll}
                  className="size-4 accent-[#6f86ff]"
                />
              </th>
              <th className="p-4 text-start">المتجر والرابط</th>
              <th className="p-4 text-start">التاجر</th>
              <th className="p-4 text-start">الحالة</th>
              <th className="p-4 text-start">شارات</th>
              <th className="p-4 text-start">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredRows.map((r) => (
              <tr
                key={r.sId}
                className={cn(
                  "transition-colors",
                  selected.has(r.sId)
                    ? "bg-[#6f86ff]/10"
                    : "hover:bg-white/[0.02]"
                )}
              >
                <td className="p-4">
                  <input
                    type="checkbox"
                    checked={selected.has(r.sId)}
                    onChange={() => toggle(r.sId)}
                    className="size-4 accent-[#6f86ff]"
                  />
                </td>
                <td className="p-4">
                  <Link
                    href={`/admin/stores/${r.sId}`}
                    className="font-bold text-white hover:text-[#8fa8ff] block text-sm"
                  >
                    {r.sName}
                  </Link>
                  <a
                    href={storeUrl(r.sSubdomain)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] text-slate-400 hover:text-white block mt-0.5"
                    dir="ltr"
                  >
                    {r.sSubdomain}.colapia.com
                  </a>
                </td>
                <td className="p-4">
                  <p className="font-bold text-white">{r.mName || "غير مسجل"}</p>
                  <p
                    className="font-mono text-slate-500 mt-0.5"
                    dir="ltr"
                  >
                    {r.mPhone}
                  </p>
                </td>
                <td className="p-4">
                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-bold text-[10px]",
                      r.sStatus === "active"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : r.sStatus === "trial"
                        ? "bg-blue-500/20 text-blue-300"
                        : "bg-white/10 text-white"
                    )}
                  >
                    {r.sStatus}
                  </span>
                </td>
                <td className="p-4 flex gap-1">
                  {r.sCustomDomain && (
                    <span title="دومين مخصص" className="inline-flex">
                      <Globe className="size-4 text-emerald-400" />
                    </span>
                  )}
                  {r.sStatus === "frozen" && (
                    <span title="مجمّد" className="inline-flex">
                      <ShieldAlert className="size-4 text-rose-400" />
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <Link
                    href={`/admin/stores/${r.sId}`}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
                  >
                    إدارة
                  </Link>
                </td>
              </tr>
            ))}
            {filteredRows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-12 text-center text-slate-500 text-xs"
                >
                  لا توجد متاجر مطابقة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}