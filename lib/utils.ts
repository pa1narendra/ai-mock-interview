import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const accentPairs = [
  ["#10b981", "#5eead4"],
  ["#0ea5e9", "#67e8f9"],
  ["#8b5cf6", "#c4b5fd"],
  ["#f59e0b", "#fcd34d"],
  ["#ec4899", "#f9a8d4"],
  ["#14b8a6", "#99f6e4"],
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

export function roleInitials(role: string): string {
  return role
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}
