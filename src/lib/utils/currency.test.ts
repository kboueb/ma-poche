import { describe, it, expect } from "vitest";
import { convertToBase, formatCurrency, formatCompact, formatPercent } from "./currency";

const norm = (s: string) => s.replace(/[\u00A0\u202F]/g, " ");

describe("convertToBase", () => {
  it("identité quand même devise (XOF par défaut)", () => {
    expect(convertToBase(1000, "XOF")).toBe(1000);
  });

  it("convertit EUR vers XOF au taux fixe", () => {
    expect(convertToBase(1, "EUR")).toBeCloseTo(655.957, 3);
  });

  it("devise inconnue traitée comme XOF", () => {
    expect(convertToBase(500, "XXX" as string)).toBe(500);
  });
});

describe("formatCurrency", () => {
  it("XOF sans décimales + suffixe FCFA", () => {
    expect(norm(formatCurrency(1234, "XOF"))).toBe("1 234 FCFA");
  });

  it("EUR avec 2 décimales + €", () => {
    expect(norm(formatCurrency(10, "EUR"))).toBe("10,00 €");
  });
});

describe("formatCompact", () => {
  it("compacte les milliers", () => {
    expect(norm(formatCompact(1500))).toBe("1,5 k");
  });
});

describe("formatPercent", () => {
  it("pourcentage fr à 1 décimale", () => {
    expect(norm(formatPercent(50))).toBe("50,0 %");
  });

  it("signe + en option", () => {
    expect(norm(formatPercent(12.5, true))).toBe("+12,5 %");
  });
});
