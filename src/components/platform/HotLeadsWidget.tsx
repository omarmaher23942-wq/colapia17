import Link from "next/link";
import { Flame, MessageSquare, ArrowLeft, UserPlus } from "lucide-react";
import { db } from "@/db/client";
import { conversations } from "@/db/schema";
import { desc, eq, gte, notInArray, and } from "drizzle-orm";

const SW = 1.75;

export async function HotLeadsWidget() {
  const leads = await db
    .select({
      id: conversations.id,
      name: conversations.profileName,
      channel: conversations.channel,
      score: conversations.leadScore,
      memory: conversations.memory,
    })
    .from(conversations)
    .where(
      and(
        gte(conversations.leadScore, 70),
        notInArray(conversations.stage, ["activated", "lost"])
      )
    )
    .orderBy(desc(conversations.leadScore))
    .limit(5);

  return (
    <section className="flex flex-col rounded-3xl border border-white/10 bg-[#0b0f2a] p-5 shadow-2xl">
      <header className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Flame className="size-4.5 text-amber-400" strokeWidth={SW} />
          <h2 className="text-sm font-black text-white">الليدز الأكثر سخونة</h2>
        </div>
        <Link href="/admin/leads" className="text-[11px] font-bold text-[#8fa8ff] hover:text-white transition-colors flex items-center gap-1">
          عرض الكل <ArrowLeft className="size-3" />
        </Link>
      </header>

      <div className="flex-1 space-y-3">
        {leads.length === 0 ? (
          <div className="grid h-32 place-items-center text-center text-[#8d97c4]">
            <div className="space-y-2">
              <UserPlus className="mx-auto size-6 opacity-40" strokeWidth={SW} />
              <p className="text-xs font-bold">لا توجد ليدز ساخنة حالياً</p>
            </div>
          </div>
        ) : (
          leads.map((l) => {
            const mem = l.memory as Record<string, any>;
            const industry = mem?.industry ?? "غير محدد";
            
            return (
              <div key={l.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3 hover:bg-white/[0.04] transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-xs font-bold text-[#eaf0ff]">{l.name || "عميل محتمل"}</p>
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-black text-amber-300">
                      {l.score}🔥
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[10.5px] text-[#8d97c4]">
                    {l.channel === "instagram" ? "إنستاجرام" : "فيسبوك"} · {industry}
                  </p>
                </div>
                <Link
                  href={`/admin/conversations?id=${l.id}`}
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#6f86ff]/15 text-[#8fa8ff] transition-colors hover:bg-[#6f86ff]/30"
                  title="محادثة فورية"
                >
                  <MessageSquare className="size-3.5" strokeWidth={SW} />
                </Link>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}