import { describe, it, expect } from "vitest";
import { formatDuration, formatDecimalHours, parseDuration, entryMinutes } from "./time";

describe("formatDuration", () => {
  it("minutes seules", () => expect(formatDuration(45)).toBe("45m"));
  it("heures rondes", () => expect(formatDuration(60)).toBe("1h"));
  it("heures + minutes", () => expect(formatDuration(90)).toBe("1h 30m"));
  it("zéro", () => expect(formatDuration(0)).toBe("0m"));
  it("arrondit", () => expect(formatDuration(89.6)).toBe("1h 30m"));
});

describe("formatDecimalHours", () => {
  it("90 min → 1,50 h", () => expect(formatDecimalHours(90)).toBe("1,50 h"));
});

describe("parseDuration", () => {
  it("1h30 → 90", () => expect(parseDuration("1h30")).toBe(90));
  it("45m → 45", () => expect(parseDuration("45m")).toBe(45));
  it("1:30 → 90", () => expect(parseDuration("1:30")).toBe(90));
  it("2h → 120", () => expect(parseDuration("2h")).toBe(120));
  it("1.5h → 90", () => expect(parseDuration("1.5h")).toBe(90));
  it("entier seul = minutes", () => expect(parseDuration("90")).toBe(90));
  it("illisible → null", () => {
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("")).toBeNull();
  });
});

describe("entryMinutes", () => {
  it("entrée terminée = écart réel", () => {
    const start = "2026-09-01T09:00:00.000Z";
    const end = "2026-09-01T10:30:00.000Z";
    expect(entryMinutes(start, end, null)).toBe(90);
  });

  it("entrée en cours sans fallback ≈ écoulé (tolérance)", () => {
    const start = new Date(Date.now() - 61 * 60000).toISOString();
    const mins = entryMinutes(start, null, null);
    expect(mins).toBeGreaterThanOrEqual(60);
    expect(mins).toBeLessThanOrEqual(62);
  });
});
