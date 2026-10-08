"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { initiateCustomerGoogleAuth } from "@/server/actions/customer-auth";

export function CustomerGoogleAuthButton({
  storeSubdomain,
  redirectAfter,
  label,
  className,
}: {
  storeSubdomain: string;
  redirectAfter: string;
  label: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      style={{
        background: "var(--primary)",
        color: "var(--primary-foreground)",
      }}
      onClick={() =>
        start(() => initiateCustomerGoogleAuth(storeSubdomain, redirectAfter))
      }
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : null}
      <span>{label}</span>
    </button>
  );
}