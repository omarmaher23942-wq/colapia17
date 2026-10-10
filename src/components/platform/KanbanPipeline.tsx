"use client";

// KanbanPipeline.tsx — لوحة كانبان لإدارة دورة حياة المتاجر.
//
// التعديل الجذري:
// سابقاً كانت `{...listeners}` مطبقة على الكارت بالكامل، مما يعني أن أي
// click يُفسَّر كبداية سحب → الكارت لا يُفتح أبداً. الآن:
//  1) نُطبّق listeners فقط على مقبض السحب (GripVertical) في رأس الكارت.
//  2) نُغلّف كل المحتوى بـ <Link href="/admin/stores/{id}"> لفتح صفحة الإدارة.
//  3) الأزرار الداخلية (تسليم، تجميد، تعديل) توقف propagation.
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ExternalLink,
  Rocket,
  Pencil,
  Lock,
  Timer,
  User as UserIcon,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { moveStoreStageAction } from "@/server/actions/platform-pipeline";
import {
  deliverNowAction,
  extendAction,
  freezeNowAction,
} from "@/server/actions/platform-ops";
import { storeUrl, cn } from "@/lib/utils";

type StoreCard = {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  merchantName: string;
  deliverAt: string | null;
  trialEndsAt: string | null;
};

const COLUMNS = [
  {
    id: "pending_review",
    title: "بانتظار المراجعة",
    color: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  {
    id: "building",
    title: "جاري البناء",
    color: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  },
  {
    id: "review",
    title: "جاهز للتسليم",
    color: "border-teal-500/30 bg-teal-500/10 text-teal-300",
  },
  {
    id: "trial",
    title: "تجربة نشطة",
    color: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  },
  {
    id: "active",
    title: "مفعّل",
    color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
] as const;

function SortableStoreCard({ store }: { store: StoreCard }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: store.id });
  const [pending, start] = useTransition();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  const action = (fn: () => Promise<unknown>, msg: string) => {
    start(async () => {
      try {
        await fn();
        toast.success(msg);
      } catch (e: unknown) {
        const err = e as { message?: string };
        toast.error(err.message || "حدث خطأ");
      }
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative rounded-2xl border border-white/10 bg-[#0c1029] p-3.5 shadow-sm transition-colors hover:border-[#8fa8ff]/40"
    >
      {/* ─── Drag handle + clickable header ─────────────────────────── */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <Link
          href={`/admin/stores/${store.id}`}
          className="min-w-0 flex-1 rounded-lg -mx-1 px-1 -my-1 py-1 hover:bg-white/[0.03]"
        >
          <p className="truncate text-xs font-black text-white">
            {store.name}
          </p>
          <span
            className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-[#8d97c4] hover:text-white"
            dir="ltr"
          >
            {store.subdomain}.colapia.com
          </span>
        </Link>

        {/* زر السحب: هذا هو العنصر الوحيد الذي يستجيب للسحب */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="سحب لإعادة الترتيب"
          className="grid size-7 shrink-0 cursor-grab place-items-center rounded-lg bg-white/5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8fa8ff]"
          onClick={(e) => e.preventDefault()}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* ─── Metadata ─────────────────────────────────────────────────── */}
      <div className="mb-3 flex items-center gap-1.5 text-[10px] text-slate-400">
        <UserIcon className="size-3" aria-hidden="true" />
        <span className="truncate">{store.merchantName || "غير مسجل"}</span>
      </div>

      {/* ─── Action buttons ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5 border-t border-white/5 pt-2.5">
        <Link
          href={`/admin/stores/${store.id}/edit`}
          className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <Pencil className="size-3" aria-hidden="true" /> تعديل
        </Link>
        <a
          href={storeUrl(store.subdomain)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <ExternalLink className="size-3" aria-hidden="true" /> معاينة
        </a>
        {store.status === "review" && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              action(() => deliverNowAction(store.id), "تم التسليم")
            }
            className="inline-flex items-center gap-1 rounded-md bg-teal-500/20 px-2 py-1 text-[10px] font-bold text-teal-300 hover:bg-teal-500/30 disabled:opacity-50"
          >
            <Rocket className="size-3" aria-hidden="true" /> تسليم
          </button>
        )}
        {store.status === "trial" && (
          <>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                action(
                  () => extendAction(store.id, "trial", 24),
                  "تم التمديد"
                )
              }
              className="inline-flex items-center gap-1 rounded-md bg-blue-500/20 px-2 py-1 text-[10px] font-bold text-blue-300 hover:bg-blue-500/30 disabled:opacity-50"
            >
              <Timer className="size-3" aria-hidden="true" /> +24س
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm("تجميد المتجر؟")) {
                  action(() => freezeNowAction(store.id), "تم التجميد");
                }
              }}
              className="inline-flex items-center gap-1 rounded-md bg-rose-500/20 px-2 py-1 text-[10px] font-bold text-rose-300 hover:bg-rose-500/30 disabled:opacity-50"
            >
              <Lock className="size-3" aria-hidden="true" /> تجميد
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function KanbanPipeline({
  initialStores,
}: {
  initialStores: StoreCard[];
}) {
  const [stores, setStores] = useState(initialStores);
  const [, start] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const storeId = active.id as string;
    const overId = over.id as string;

    const activeStore = stores.find((s) => s.id === storeId);
    if (!activeStore) return;

    const isOverColumn = COLUMNS.some((c) => c.id === overId);
    const targetStatus = isOverColumn
      ? overId
      : stores.find((s) => s.id === overId)?.status;

    if (targetStatus && targetStatus !== activeStore.status) {
      setStores((prev) =>
        prev.map((s) =>
          s.id === storeId ? { ...s, status: targetStatus } : s
        )
      );

      start(async () => {
        const res = await moveStoreStageAction(
          storeId,
          targetStatus as
            | "pending_review"
            | "building"
            | "review"
            | "trial"
            | "active",
          "drag_and_drop"
        );
        if (!res.ok) {
          toast.error(res.error);
          setStores(initialStores);
        } else {
          toast.success("تم نقل المتجر بنجاح");
        }
      });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="hide-scrollbar flex min-h-[70vh] gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colStores = stores.filter((s) => s.status === col.id);
          return (
            <div
              key={col.id}
              className="flex w-80 shrink-0 flex-col rounded-3xl border border-white/10 bg-[#0e1424] p-3"
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-[11px] font-black",
                    col.color
                  )}
                >
                  {col.title}
                </span>
                <span className="font-mono text-xs font-bold text-[#8d97c4]">
                  {colStores.length}
                </span>
              </div>

              <SortableContext
                id={col.id}
                items={colStores.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="min-h-[150px] flex-1 space-y-3 overflow-y-auto p-1">
                  {colStores.map((store) => (
                    <SortableStoreCard key={store.id} store={store} />
                  ))}
                  {colStores.length === 0 && (
                    <div className="grid h-24 place-items-center rounded-2xl border border-dashed border-white/5 text-[11px] text-slate-500">
                      إفلات هنا
                    </div>
                  )}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>
    </DndContext>
  );
}