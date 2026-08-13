import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Cool slate-gray gradients (no hue) — cards keep a subtle per-role identity
// through lightness alone, never color.
const accentPairs = [
  ["#3b4250", "#5b6472"],
  ["#2f3540", "#4a5260"],
  ["#454b57", "#646c7a"],
  ["#343a45", "#565e6c"],
  ["#3f4653", "#606776"],
  ["#2b303a", "#474e5b"],
] as const;

// Deterministic accent gradient per role so cards keep a stable identity
// without shipping any image assets.
export function roleAccent(seed: string): { from: string; to: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const [from, to] = accentPairs[Math.abs(hash) % accentPairs.length];
  return { from, to };
}

// Shared score → colour mapping so every score reads the same everywhere.
// Four tiers: green (strong) · yellow (ok) · red (poor) · black/grey (worst).
export function scoreTone(score: number): string {
  if (score >= 75) return "text-success";
  if (score >= 50) return "text-warning";
  if (score >= 25) return "text-danger";
  return "text-worst";
}

export function scoreBar(score: number): string {
  if (score >= 75) return "bg-success";
  if (score >= 50) return "bg-warning";
  if (score >= 25) return "bg-danger";
  return "bg-worst";
}

export function roleInitials(role: string): string {
  return role
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}
