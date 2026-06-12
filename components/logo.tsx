import Link from "next/link";
import { cn } from "@/lib/utils";

const Logo = ({ href = "/", className }: { href?: string; className?: string }) => (
  <Link href={href} className={cn("flex items-center gap-2.5", className)}>
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="mockstar-spark" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#5eead4" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" stroke="url(#mockstar-spark)" strokeWidth="2" />
      <path
        d="M16 6.5 L18.4 13.6 L25.5 16 L18.4 18.4 L16 25.5 L13.6 18.4 L6.5 16 L13.6 13.6 Z"
        fill="url(#mockstar-spark)"
      />
    </svg>
    <span className="font-display text-xl font-semibold tracking-tight text-mist-100">
      mock<span className="text-spark-gradient">star</span>
    </span>
  </Link>
);

export default Logo;
