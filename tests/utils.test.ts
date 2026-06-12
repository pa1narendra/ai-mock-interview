import { describe, expect, it } from "vitest";
import { roleAccent, roleInitials, cn } from "@/lib/utils";

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
