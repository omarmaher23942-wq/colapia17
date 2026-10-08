"use client";

// «حركة متجرك»: أربعة اختيارات بمعاينة متحركة حية لكل منها، ومفتاح للعمق ثلاثي الأبعاد.
// المعاينة تشرح الفرق بالعين بدل الكلام: هادئ يظهر بنعومة، حيوي يتتابع، سينمائي يتكشف كلمة كلمة ويدور.
import { Box, Clapperboard, Feather, Wand2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { SwitchCard } from "./ui";
import type { MotionStyle } from "./model";

const OPTIONS: { id: MotionStyle; title: string; sub: string; icon: typeof Feather }[] = [
  { id: "auto", title: "اختر لي", sub: "يختارها المصمم حسب نشاطك", icon: Wand2 },
  { id: "calm", title: "هادئ", sub: "ظهور ناعم ورصين", icon: Feather },
  { id: "lively", title: "حيوي", sub: "عناصر تتتابع وبطاقات تستجيب", icon: Zap },
  { id: "cinematic", title: "سينمائي", sub: "عناوين تتكشف وعمق ودوران", icon: Clapperboard },
];

export function MotionPicker({
  value,
  depth,
  onChange,
  onDepth,
  hideAuto = false,
}: {
  value: MotionStyle;
  depth: boolean;
  onChange: (v: MotionStyle) => void;
  onDepth: (v: boolean) => void;
  /** في اللوحة: المتجر له حركة فعلية، فلا خيار «اختر لي». */
  hideAuto?: boolean;
}) {
  return (
    <div className="space-y-3">
      <style>{CSS}</style>
      <div role="radiogroup" aria-label="حركة المتجر" className={cn("grid grid-cols-2 gap-2", hideAuto ? "sm:grid-cols-3" : "sm:grid-cols-4")}>
        {OPTIONS.filter((o) => !hideAuto || o.id !== "auto").map((o) => {
          const on = value === o.id;
          const Icon = o.icon;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.id)}
              className={cn("group overflow-hidden rounded-2xl border text-start transition", on ? "border-nova/60 bg-nova/[0.12]" : "border-edge/10 hover:border-edge/25")}
            >
              <Demo kind={o.id} playing={on} />
              <span className="block p-2.5">
                <span className="flex items-center gap-1.5 text-[12.5px] font-black text-ink">
                  <Icon className="size-3.5 text-nova-2" /> {o.title}
                </span>
                <span className="mt-0.5 block text-[11px] leading-5 text-ink-3">{o.sub}</span>
              </span>
            </button>
          );
        })}
      </div>
      <SwitchCard
        icon={Box}
        title="عمق ثلاثي الأبعاد"
        sub="البطاقات والصور تميل مع حركة المؤشر بلمعة خفيفة، وطبقات الواجهة تتحرك بعمق مع التمرير."
        on={depth}
        onChange={onDepth}
      />
    </div>
  );
}

/** معاينة مصغّرة تتحرك باستمرار للاختيار المحدد، ومرة عند المرور على غيره. */
function Demo({ kind, playing }: { kind: MotionStyle; playing: boolean }) {
  return (
    <span aria-hidden="true" className={cn("mp-demo relative block h-20 overflow-hidden bg-gradient-to-br from-nova/25 via-edge/[0.04] to-aurora/20", `mp-${kind}`, playing && "mp-play")}>
      {kind === "cinematic" ? (
        <span className="mp-ring">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="mp-card" style={{ ["--i" as string]: i }} />
          ))}
        </span>
      ) : (
        <span className="absolute inset-x-3 top-3 flex flex-col gap-1.5">
          <span className="mp-bar w-3/4" style={{ ["--d" as string]: "0ms" }} />
          <span className="mp-bar w-1/2" style={{ ["--d" as string]: "140ms" }} />
          <span className="mt-1 flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="mp-tile" style={{ ["--d" as string]: `${280 + i * 120}ms` }} />
            ))}
          </span>
        </span>
      )}
      {kind === "auto" ? <span className="mp-spark" /> : null}
    </span>
  );
}

const CSS = `
.mp-bar{display:block;height:7px;border-radius:99px;background:rgb(255 255 255 / .55)}
.mp-tile{display:block;height:22px;flex:1;border-radius:6px;background:rgb(255 255 255 / .35)}
.mp-demo:hover .mp-bar,.mp-demo:hover .mp-tile,.mp-play .mp-bar,.mp-play .mp-tile{animation-play-state:running}
.mp-calm .mp-bar,.mp-calm .mp-tile{animation:mp-fade 2.6s ease-in-out infinite paused}
.mp-lively .mp-bar,.mp-lively .mp-tile{animation:mp-pop 2.4s cubic-bezier(.22,1,.36,1) infinite paused;animation-delay:var(--d)}
.mp-auto .mp-bar,.mp-auto .mp-tile{animation:mp-pop 2.8s cubic-bezier(.22,1,.36,1) infinite paused;animation-delay:var(--d)}
@keyframes mp-fade{0%,100%{opacity:.35}50%{opacity:1}}
@keyframes mp-pop{0%{opacity:0;transform:translateY(8px)}25%,80%{opacity:1;transform:none}100%{opacity:0}}
.mp-ring{position:absolute;inset:0;margin:auto;width:26px;height:36px;transform-style:preserve-3d;animation:mp-spin 7s linear infinite paused}
.mp-demo{perspective:260px}
.mp-demo:hover .mp-ring,.mp-play .mp-ring{animation-play-state:running}
.mp-card{position:absolute;inset:0;border-radius:6px;background:linear-gradient(160deg,rgb(255 255 255 / .85),rgb(255 255 255 / .35));transform:rotateY(calc(var(--i) * 72deg)) translateZ(34px);box-shadow:0 6px 14px rgb(0 0 0 / .2)}
@keyframes mp-spin{from{transform:rotateX(-10deg) rotateY(0)}to{transform:rotateX(-10deg) rotateY(360deg)}}
.mp-spark{position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgb(255 255 255 / .35) 50%,transparent 70%);background-size:220% 100%;animation:mp-sheen 2.8s linear infinite}
@keyframes mp-sheen{from{background-position:120% 0}to{background-position:-120% 0}}
@media (prefers-reduced-motion:reduce){.mp-demo *{animation:none!important}}
`;
