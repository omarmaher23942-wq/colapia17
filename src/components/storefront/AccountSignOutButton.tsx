"use client";

// زر تسجيل خروج للمشتري — يستدعي action ثم يعيد التوجيه للصفحة الرئيسية.
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { customerLogoutBySubdomain } from "@/server/actions/customer-auth";

export function AccountSignOutButton({
  storeSubdomain,
  className,
  children,
}: {
  storeSubdomain: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await customerLogoutBySubdomain(storeSubdomain);
          router.push("/");
          router.refresh();
        })
      }
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        children
      )}
    </button>
  );
}