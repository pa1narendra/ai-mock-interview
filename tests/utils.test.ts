import { describe, expect, it } from "vitest";
import { roleAccent, roleInitials, cn, averageScore, keepHeadAndTail } from "@/lib/utils";

describe("roleAccent", () => {
  it("is deterministic for the same role", () => {
    expect(roleAccent("Frontend Developer")).toEqual(roleAccent("Frontend Developer"));
  });

  it("returns valid hex colors", () => {
    const { from, to } = roleAccent("Anything At All");
    expect(from).toMatch(/^#[0-9a-f]{6}$/);
    expect(to).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("roleInitials", () => {
  it("takes the first letters of up to two words", () => {
    expect(roleInitials("Frontend Developer")).toBe("FD");
    expect(roleInitials("Senior Backend Engineer")).toBe("SB");
    expect(roleInitials("devops")).toBe("D");
  });

  it("handles extra whitespace", () => {
    expect(roleInitials("  data   scientist ")).toBe("DS");
  });
});

describe("cn", () => {
  it("merges conflicting tailwind classes, last wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

describe("averageScore", () => {
  it("is the rounded mean of the category scores", () => {
    expect(averageScore([{ score: 70 }, { score: 80 }, { score: 75 }])).toBe(75);
    expect(averageScore([{ score: 61 }, { score: 62 }])).toBe(62);
  });

  it("clamps out-of-range scores and handles an empty list", () => {
    expect(averageScore([{ score: 150 }, { score: -20 }])).toBe(50);
    expect(averageScore([])).toBe(0);
  });
});

describe("keepHeadAndTail", () => {
  it("leaves short text alone", () => {
    expect(keepHeadAndTail("short", 100)).toBe("short");
  });

  it("keeps the start and the end within the limit", () => {
    const text = "START" + "x".repeat(10_000) + "END";
    const out = keepHeadAndTail(text, 1_000);
    expect(out.length).toBeLessThanOrEqual(1_000);
    expect(out.startsWith("START")).toBe(true);
    expect(out.endsWith("END")).toBe(true);
    expect(out).toContain("omitted");
  });
});
