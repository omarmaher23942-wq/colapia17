"use client";

// CampaignsPanel — «روابط الحملات»: رابط لكل إعلان يفتح وجهته (الرئيسية أو منتج أو قسم) بكود خصم اختياري، وأداء كل
// رابط بأرقام فعلية: النقرات، والطلبات والمبيعات المنسوبة إليه (طلبات خلال 30 يوماً من آخر نقرة على الجهاز نفسه).
import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { deleteCampaignAction, saveCampaignAction } from "@/server/actions/marketing";
import { PLATFORM_LABEL, type Campaign } from "@/lib/campaigns";
import { formatEgp } from "@/lib/money";
import { fmtNum } from "@/lib/format";
import { CopyField } from "./CopyField";
import { ConfirmDialog } from "@/components/dashboard/ui/DashDialog";

type Option = { slug: string; name: string };
type Stat = { clicks: number; orders: number; sales: number };

const SELECT = "mt-1.5 w-full rounded-xl border border-edge/10 bg-edge/[0.03] px-3 py-2.5 text-[15px] text-ink outline-none focus:border-nova";

export function CampaignsPanel({
  campaigns,
  stats,
  baseUrl,
  products,
  categories,
  codes,
  canEdit,
}: {
  campaigns: Campaign[];
  stats: Record<string, Stat>;
  baseUrl: string;
  products: Option[];
  categories: Option[];
  codes: { code: string; label: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(campaigns.length === 0);
  const [f, setF] = useState({ name: "", platform: "facebook" as Campaign["platform"], targetType: "home" as Campaign["target"]["type"], targetSlug: "", code: "" });

  const create = () =>
    start(async () => {
      const r = await saveCampaignAction({ ...f, targetSlug: f.targetSlug || undefined, code: f.code || undefined });
      if (!r.ok) return void toast.error(r.error);
      toast.success("جاهز. انسخ الرابط وضعه في إعلانك");
      setF({ name: "", platform: f.platform, targetType: "home", targetSlug: "", code: "" });
      setOpen(false);
      router.refresh();
    });

  const [removing, setRemoving] = useState<Campaign | null>(null);
  const remove = async (): Promise<boolean> => {
    if (!removing) return true;
    const r = await deleteCampaignAction(removing.slug);
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    setRemoving(null);
    router.refresh();
    return true;
  };

  return (
    <section className="dash-card space-y-4 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-black text-ink">روابط الحملات</h2>
          <p className="mt-1 text-[12.5px] leading-6 text-ink-2">رابط مختلف لكل إعلان يخبرك أي إعلان جاب طلبات فعلاً، ويفتح المنتج المعلَن عنه مباشرة بكود الخصم.</p>
        </div>
        {canEdit && !open ? (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-nova px-4 text-[13px] font-black text-white">
            <Plus className="size-4" aria-hidden="true" /> حملة جديدة
          </button>
        ) : null}
      </header>

      {canEdit && open ? (
        <div className="grid gap-3 rounded-xl border border-edge/10 p-4 sm:grid-cols-2">
          <label className="text-[13px] font-bold text-ink sm:col-span-2">
            اسم الحملة (لك وحدك)
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="مثال: فستان الصيف - ريلز" className={SELECT} />
          </label>
          <label className="text-[13px] font-bold text-ink">
            مكان الإعلان
            <select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value as Campaign["platform"] })} className={SELECT}>
              {Object.entries(PLATFORM_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[13px] font-bold text-ink">
            يفتح على
            <select value={f.targetType} onChange={(e) => setF({ ...f, targetType: e.target.value as Campaign["target"]["type"], targetSlug: "" })} className={SELECT}>
              <option value="home">الصفحة الرئيسية</option>
              <option value="product" disabled={!products.length}>
                منتج
              </option>
              <option value="category" disabled={!categories.length}>
                قسم
              </option>
            </select>
          </label>
          {f.targetType !== "home" ? (
            <label className="text-[13px] font-bold text-ink">
              {f.targetType === "product" ? "المنتج" : "القسم"}
              <select value={f.targetSlug} onChange={(e) => setF({ ...f, targetSlug: e.target.value })} className={SELECT}>
                <option value="">اختر…</option>
                {(f.targetType === "product" ? products : categories).map((o) => (
                  <option key={o.slug} value={o.slug}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="text-[13px] font-bold text-ink">
            كود خصم (اختياري)
            <select value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className={SELECT}>
              <option value="">بدون كود</option>
              {codes.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.label})
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" onClick={create} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-nova px-5 text-[13.5px] font-black text-white disabled:opacity-50">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null} أنشئ الرابط
            </button>
            {campaigns.length ? (
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl border border-edge/10 px-4 text-[13px] font-bold text-ink-2">
                إلغاء
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {campaigns.length ? (
        <ul className="divide-y divide-edge/[0.06]">
          {campaigns.map((c) => {
            const st = stats[c.slug] ?? { clicks: 0, orders: 0, sales: 0 };
            const target = c.target.type === "home" ? "الرئيسية" : (c.target.type === "product" ? products : categories).find((o) => o.slug === c.target.slug)?.name ?? "وجهة محذوفة";
            return (
              <li key={c.slug} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13.5px] font-black text-ink">
                    {c.name}
                    <span className="ms-2 text-[11.5px] font-normal text-ink-3">
                      {PLATFORM_LABEL[c.platform]} · {target}
                      {c.code ? ` · ${c.code}` : ""}
                    </span>
                  </p>
                  {canEdit ? (
                    <button type="button" onClick={() => setRemoving(c)} disabled={pending} aria-label={`حذف ${c.name}`} className="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-bad/10 hover:text-bad">
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <CopyField value={`${baseUrl}/go/${c.slug}`} label={`رابط ${c.name}`} />
                <dl className="grid grid-cols-3 gap-2 text-center text-[12px]">
                  <div className="rounded-lg bg-edge/[0.03] p-2">
                    <dt className="text-ink-3">نقرات</dt>
                    <dd className="text-[15px] font-black tabular-nums text-ink">{fmtNum(st.clicks)}</dd>
                  </div>
                  <div className="rounded-lg bg-edge/[0.03] p-2">
                    <dt className="text-ink-3">طلبات</dt>
                    <dd className="text-[15px] font-black tabular-nums text-ink">
                      {fmtNum(st.orders)}
                      {st.clicks > 0 && st.orders > 0 ? <span className="ms-1 text-[11px] font-bold text-ok">{((st.orders / st.clicks) * 100).toFixed(1)}٪</span> : null}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-edge/[0.03] p-2">
                    <dt className="text-ink-3">مبيعات</dt>
                    <dd className="text-[15px] font-black tabular-nums text-ink">{formatEgp(st.sales)}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      ) : null}
      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`حذف حملة «${removing?.name ?? ""}»؟`}
        description="الرابط سيفتح الرئيسية بعدها، وطلباتها السابقة تبقى في سجلها."
        confirmLabel="حذف"
        tone="danger"
        onConfirm={remove}
      />
    </section>
  );
}
