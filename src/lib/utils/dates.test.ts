import { describe, it, expect } from "vitest";
import { formatDue, formatRelative } from "./dates";

const isoDay = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

describe("formatDue", () => {
  it("aujourd'hui", () => expect(formatDue(isoDay(0))).toBe("Aujourd'hui"));
  it("demain", () => expect(formatDue(isoDay(1))).toBe("Demain"));
  it("dans moins d'une semaine", () => expect(formatDue(isoDay(5))).toBe("Dans 5 j"));
  it("en semaines", () => expect(formatDue(isoDay(14))).toBe("Dans 2 sem."));
  it("retard récent", () => expect(formatDue(isoDay(-3))).toBe("En retard de 3 j"));
  it("hier", () => expect(formatDue(isoDay(-1))).toBe("Hier"));
});

describe("formatRelative", () => {
  it("aujourd'hui", () => expect(formatRelative(isoDay(0))).toBe("Aujourd'hui"));
  it("hier", () => expect(formatRelative(isoDay(-1))).toBe("Hier"));
});
