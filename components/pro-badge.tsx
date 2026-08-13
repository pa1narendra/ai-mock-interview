import { cn } from "@/lib/utils";

const ProBadge = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full border border-highlight/40 bg-highlight-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-highlight",
      className
    )}
  >
    Pro
  </span>
);

export default ProBadge;
