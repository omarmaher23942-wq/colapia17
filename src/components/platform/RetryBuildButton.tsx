"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { retryBuildAction } from "@/server/actions/platform-ops";
export function RetryBuildButton({ storeId }: { storeId: string }) { const [p, start] = useTransition(); return <button disabled={p} onClick={() => start(async () => { try { await retryBuildAction(storeId); toast.success("أُعيد تشغيل البناء"); } catch (e) { toast.error(String(e)); } })} className="mt-2 rounded-md bg-amber-500 px-3 py-1 text-[11px] font-bold text-black disabled:opacity-40">🔁 إعادة البناء</button>; }
