"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Link2,
  Copy,
  Check,
  Gift,
  Trophy,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import {
  generateMerchantReferralLinkAction,
  claimReferralRewardAction,
  getReferralLeaderboardAction,
} from "@/server/actions/referral";
import { cn } from "@/lib/utils";

export function ReferralDashboard() {
  const [data, setData] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const [refRes, leadRes] = await Promise.all([
        generateMerchantReferralLinkAction(),
        getReferralLeaderboardAction(),
      ]);
      if (refRes.ok) setData(refRes.data ?? null);
      if (leadRes.ok) setLeaderboard(leadRes.data ?? []);
      setLoading(false);
    }

    void load();
  }, []);

  const copyLink = () => {
    if (!data?.referralLink) return;
    navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    toast.success("تم نسخ رابط الإحالة");
    setTimeout(() => setCopied(false), 2000);
  };

  const claimReward = async (id: string) => {
    const res = await claimReferralRewardAction(id);
    if (res.ok) {
      toast.success("تم صرف المكافأة بنجاح 🎉");
      const refRes = await generateMerchantReferralLinkAction();
      if (refRes.ok) setData(refRes.data);
    } else {
      toast.error(res.error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-nova-2" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="relative overflow-hidden rounded-3xl border border-nova-2/30 bg-gradient-to-br from-nova/20 to-space-2 p-8 shadow-2xl">
        <div className="absolute -top-24 -start-24 size-64 rounded-full bg-nova-2/20 blur-3xl" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-start">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-nova-2/20 px-3 py-1 text-xs font-bold text-nova-2">
              <Gift className="size-3.5" /> برنامج شركاء كولابيا
            </span>
            <h2 className="text-2xl font-black text-ink sm:text-3xl">
              شارك نجاحك، واكسب مكافآت
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-ink-2">
              ادعُ تجاراً آخرين لفتح متاجرهم على كولابيا باستخدام رابطك الخاص.
              ستحصل على شهر مجاني أو مكافأة نقدية عن كل متجر يتم تفعيله!
            </p>
          </div>

          <div className="w-full max-w-sm rounded-2xl border border-edge/10 bg-space/60 p-4 backdrop-blur-md">
            <p className="mb-2 text-xs font-bold text-ink-3">
              رابط الإحالة الخاص بك
            </p>
            <div className="flex items-center gap-2 rounded-xl border border-edge/10 bg-black/40 p-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-edge/5 text-ink-3">
                <Link2 className="size-4" />
              </div>
              <span
                className="flex-1 truncate font-mono text-xs text-ink"
                dir="ltr"
              >
                {data?.referralLink}
              </span>
              <button
                onClick={copyLink}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-nova text-space transition-transform hover:scale-105 active:scale-95"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-edge/10 bg-space-2 p-5 shadow-lg">
              <div className="flex items-center gap-2 text-ink-3 mb-2">
                <Users className="size-4" />
                <span className="text-xs font-bold">إجمالي الدعوات</span>
              </div>
              <p className="text-3xl font-black text-ink font-mono">
                {data?.stats.totalReferred}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-lg">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2">
                <CheckCircle2 className="size-4" />
                <span className="text-xs font-bold">متاجر تم تفعيلها</span>
              </div>
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-300 font-mono">
                {data?.stats.activeReferred}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-edge/10 bg-space-2 p-5 shadow-lg">
            <h3 className="text-sm font-black text-ink mb-4 flex items-center gap-2">
              <Gift className="size-4 text-nova-2" /> المكافآت المكتسبة
            </h3>
            {data?.rewards.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-3">
                لا توجد مكافآت بعد. ابدأ بدعوة أصدقائك!
              </div>
            ) : (
              <ul className="space-y-3">
                {data?.rewards.map((r: any) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-edge/5 bg-edge/[0.02] p-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-ink">
                        {r.rewardType === "free_month"
                          ? "شهر مجاني إضافي"
                          : `مكافأة نقدية (${r.amountPiasters / 100} ج)`}
                      </p>
                      <p className="text-[10px] text-ink-3 mt-0.5">
                        {new Date(r.createdAt).toLocaleDateString("ar-EG")}
                      </p>
                    </div>
                    {r.isClaimed ? (
                      <span className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        تم الصرف
                      </span>
                    ) : (
                      <button
                        onClick={() => claimReward(r.id)}
                        className="rounded-lg bg-gradient-to-l from-nova to-nova-2 px-4 py-1.5 text-[10px] font-black text-space shadow-md hover:brightness-110 transition-all"
                      >
                        صرف المكافأة
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-b from-amber-500/5 to-space-2 p-5 shadow-lg">
          <h3 className="text-sm font-black text-amber-700 dark:text-amber-400 mb-4 flex items-center gap-2">
            <Trophy className="size-4" /> لوحة الشرف (Top Referrals)
          </h3>
          <ul className="space-y-3">
            {leaderboard.map((l, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-xl border border-edge/5 bg-black/20 p-2.5"
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-black",
                    i === 0
                      ? "bg-amber-400 text-amber-900"
                      : i === 1
                      ? "bg-edge/15 text-ink"
                      : i === 2
                      ? "bg-orange-400 text-orange-900"
                      : "bg-edge/10 text-ink-3"
                  )}
                >
                  {i + 1}
                </span>
                {l.avatarUrl ? (
                  <img
                    src={l.avatarUrl}
                    alt=""
                    className="size-8 rounded-full object-cover border border-edge/10"
                  />
                ) : (
                  <span className="grid size-8 place-items-center rounded-full bg-edge/10 text-xs font-bold text-ink">
                    {l.merchantName.charAt(0)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink">
                    {l.merchantName}
                  </p>
                </div>
                <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {l.referralsCount}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}