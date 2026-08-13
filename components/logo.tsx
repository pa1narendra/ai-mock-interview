import Link from "next/link";
import { cn } from "@/lib/utils";

// Wordmark + a single "live dot" — the recording indicator of a real-time
// voice session. Doubles as a confident editorial period. No icon, no star.
const Logo = ({ href = "/", className }: { href?: string; className?: string }) => (
  <Link
    href={href}
    className={cn(
      "flex items-baseline gap-1 font-display text-xl font-semibold tracking-tight text-foreground",
      className
    )}
  >
    mockstar
    <span aria-hidden className="size-[7px] translate-y-[-1px] rounded-full bg-primary" />
  </Link>
);

export default Logo;
