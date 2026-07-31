import { describe, expect, it } from "vitest";
import { getGreeting } from "./greeting";

describe("getGreeting", () => {
  it("uses the browser-local time of day", () => {
    expect(getGreeting(new Date(2026, 6, 31, 8))).toBe("Good morning.");
    expect(getGreeting(new Date(2026, 6, 31, 14))).toBe("Good afternoon.");
    expect(getGreeting(new Date(2026, 6, 31, 20))).toBe("Good evening.");
  });

  it("only includes a configured non-empty name", () => {
    expect(getGreeting(new Date(2026, 6, 31, 14), "  ")).toBe("Good afternoon.");
    expect(getGreeting(new Date(2026, 6, 31, 14), "Alex")).toBe("Good afternoon, Alex.");
  });
});
