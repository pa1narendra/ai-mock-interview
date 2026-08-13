"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import ProBadge from "./pro-badge";

const ReferralCard = ({
  code,
  referralCount,
  isPro,
}: {
  code: string;
  referralCount: number;
  isPro: boolean;
}) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/sign-up?ref=${code}`);
      setCopied(true);
      toast.success("Invite link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy - long-press the link to copy it manually.");
    }
  };

  return (
    <div className="panel flex flex-col gap-4 px-8 py-6">
      <div className="flex items-center justify-between gap-3">
        <h3>Invite a friend</h3>
        {isPro && <ProBadge />}
      </div>
      <p className="text-sm">
        {isPro
          ? "You've unlocked Pro - thanks for spreading the word."
          : "When a friend joins with your link and finishes one interview, you unlock Pro: voice selection, question preview, a PRO badge, community customization, and higher limits (20 interviews, 5 attempts)."}
      </p>
      <div className="flex items-center gap-2 max-sm:flex-col max-sm:items-stretch">
        <code className="flex-1 truncate rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm text-text-secondary">
          /sign-up?ref={code}
        </code>
        <button onClick={copy} className="btn-outline !px-4 !py-2.5">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy link
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        {referralCount === 0
          ? "No referrals converted yet."
          : `${referralCount} referral${referralCount === 1 ? "" : "s"} converted.`}
      </p>
    </div>
  );
};

export default ReferralCard;
