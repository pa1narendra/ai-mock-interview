"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

const ThemeToggle = ({ className }: { className?: string }) => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The resolved theme is only known on the client, so until we've mounted we
  // render a stable, theme-agnostic placeholder. Server HTML and the first
  // client render then match exactly (no hydration mismatch); the real icon /
  // label swap in on the next client render. This one-shot mount flag is the
  // intended next-themes pattern, so the set-state-in-effect rule doesn't apply.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      suppressHydrationWarning
      aria-label={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      onClick={() => mounted && setTheme(isDark ? "light" : "dark")}
      className={
        "inline-flex size-9 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:text-primary hover:border-primary/40 cursor-pointer " +
        (className ?? "")
      }
    >
      {mounted && isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
};

export default ThemeToggle;
