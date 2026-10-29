import { describe, it, expect } from "vitest";
import { buildReminderDigest, alreadyNotified, recordNotified, buildDunningMailto } from "./reminders";
import type { UpcomingPayment } from "./upcomingPayments";

const due = (over: Partial<UpcomingPayment>): UpcomingPayment => ({
  id: "x", label: "x", amount: 100, flow: "expense", dueDate: "", daysUntil: 1, source: "recurrence",
  ...over,
});

describe("buildReminderDigest", () => {
  it("sépare les factures en retard des échéances proches", () => {
    const digest = buildReminderDigest([
      due({ id: "inv-1", source: "invoice", flow: "income", amount: 500, daysUntil: -3 }),
      due({ id: "loyer", amount: 300, daysUntil: 2 }),
      due({ id: "loin", daysUntil: 10 }),
    ]);
    expect(digest).toHaveLength(2);
    expect(digest[0]).toMatchObject({ title: "maPoche — Factures en retard", ids: ["inv-1"] });
    expect(digest[0].body).toContain("1 paiement client en retard");
    expect(digest[1]).toMatchObject({ title: "maPoche — Échéances à venir", ids: ["loyer"] });
    expect(digest[1].body).toContain("1 échéance sous 3 jours");
  });

  it("rien à signaler : aucune notification", () => {
    expect(buildReminderDigest([due({ daysUntil: 12 })])).toEqual([]);
  });

  it("une dépense récurrente en retard ne déclenche pas de relance client", () => {
    expect(buildReminderDigest([due({ daysUntil: -2 })])).toEqual([]);
  });
});

describe("journal des notifications", () => {
  it("ne renotifie pas le même jour, mais renotifie le lendemain ou pour une nouvelle échéance", () => {
    const log = recordNotified(null, "2026-10-29", ["a", "b"]);
    expect(alreadyNotified(log, "2026-10-29", ["a"])).toBe(true);
    expect(alreadyNotified(log, "2026-10-29", ["a", "c"])).toBe(false);
    expect(alreadyNotified(log, "2026-10-30", ["a"])).toBe(false);
    expect(recordNotified(log, "2026-10-30", ["c"])).toEqual({ date: "2026-10-30", ids: ["c"] });
  });
});

describe("buildDunningMailto", () => {
  it("reprend l'e-mail des coordonnées client et préremplit sujet et message", () => {
    const url = buildDunningMailto({
      number: "2026-007", label: "Solde", amount: 700, dueDate: "2026-10-15",
      clientName: "Acme", clientDetails: "Acme SARL\ncompta@acme.ci\nAbidjan", issuerName: "Kani",
    });
    expect(url.startsWith("mailto:compta%40acme.ci?subject=")).toBe(true);
    const body = decodeURIComponent(url.split("&body=")[1]);
    expect(decodeURIComponent(url.split("subject=")[1].split("&")[0])).toBe("Relance — facture 2026-007");
    expect(body).toContain("Bonjour Acme,");
    expect(body).toContain("facture 2026-007 (Solde)");
    expect(body).toContain("15 octobre 2026");
    expect(body.endsWith("Kani")).toBe(true);
  });

  it("sans e-mail connu : destinataire vide", () => {
    const url = buildDunningMailto({ number: "1", label: "Facture", amount: 1, dueDate: null });
    expect(url.startsWith("mailto:?subject=")).toBe(true);
  });
});
