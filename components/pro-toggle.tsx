"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setUserPro } from "@/lib/actions/referral";
import { cn } from "@/lib/utils";

const ProToggle = ({ userId, isPro }: { userId: string; isPro: boolean }) => {
  const [on, setOn] = useState(isPro);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !on;
    setOn(next); // optimistic
    startTransition(async () => {
      const res = await setUserPro(userId, next);
      if (!res.success) {
        setOn(!next);
        toast.error("Couldn't update - try again.");
      } else {
        toast.success(next ? "Pro granted" : "Pro removed");
      }
    });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? "Remove Pro" : "Grant Pro"}
      onClick={toggle}
      disabled={pending}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
        on ? "bg-highlight" : "border border-border bg-surface-raised"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
          on ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
};

export default ProToggle;
