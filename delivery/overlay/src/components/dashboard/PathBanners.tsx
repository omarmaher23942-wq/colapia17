"use client";

// PathBanners (مشروعك الخاص) — لا اشتراك ولا تجربة ولا فريق: لا لافتات أعلى المحتوى. يبقى المكوّن بواجهته المشتركة.
import type { StorePerms } from "@/lib/store-perms";
import type { HostingState } from "@/lib/hosting";

export function PathBanners(_props: {
  hosting?: HostingState;
  perms?: StorePerms | null;
  trial?: { endsAt: string; reviewPending: boolean } | null;
  lock?: "frozen" | "paused" | null;
}) {
  return null;
}
