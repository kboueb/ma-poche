import { describe, it, expect } from "vitest";
import { parseAuthError, shouldRelock } from "./useLockStore";

describe("parseAuthError", () => {
  it("reconnaît une annulation par l'utilisateur", () => {
    expect(parseAuthError("-2:Canceled by user.")).toEqual({ cancelled: true, message: "Canceled by user." });
  });
  it("un échec d'authentification n'est pas une annulation", () => {
    expect(parseAuthError("-1:Application retry limit exceeded.")).toEqual({ cancelled: false, message: "Application retry limit exceeded." });
  });
  it("garde le message brut s'il n'a pas de code", () => {
    expect(parseAuthError("no-reply")).toEqual({ cancelled: false, message: "no-reply" });
  });
});

describe("shouldRelock", () => {
  it("reverrouille au-delà du délai, pas avant", () => {
    expect(shouldRelock(4 * 60_000, 5)).toBe(false);
    expect(shouldRelock(5 * 60_000, 5)).toBe(true);
  });
  it("délai 0 : reverrouille à chaque retour", () => {
    expect(shouldRelock(1, 0)).toBe(true);
  });
});
