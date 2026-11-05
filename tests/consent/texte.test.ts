import { expect, test } from "vitest";
import { ARTEN, EINWILLIGUNGSTEXTE } from "../../lib/consent/texte";

test("jede Art A bis E hat Version, Text und Gesundheits-Flag", () => {
  expect(ARTEN).toEqual(["A", "B", "C", "D", "E"]);
  for (const art of ARTEN) {
    const t = EINWILLIGUNGSTEXTE[art];
    expect(t.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(t.text.length).toBeGreaterThan(50);
    expect(typeof t.gesundheitsdaten).toBe("boolean");
  }
});

test("B ist die Gesundheitsdaten-Einwilligung, A nicht", () => {
  expect(EINWILLIGUNGSTEXTE.B.gesundheitsdaten).toBe(true);
  expect(EINWILLIGUNGSTEXTE.A.gesundheitsdaten).toBe(false);
});

test("Anbieter bleibt Platzhalter, bis Sinan ihn festlegt", () => {
  expect(EINWILLIGUNGSTEXTE.D.text).toContain("[Anbieter]");
  expect(EINWILLIGUNGSTEXTE.E.text).toContain("[Anbieter]");
});
