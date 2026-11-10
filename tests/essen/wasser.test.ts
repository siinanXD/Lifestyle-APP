import { describe, expect, test } from "vitest";
import { neuerEintrag } from "../../lib/offline/queue";
import { istGueltigeMenge, letzteTage, loescheWasser, tagessumme, trageWasserEin, wasserSeit } from "../../lib/essen/wasser";

// Kette wie im Supabase-Client: jede Methode gibt sich selbst zurück, `await` liefert das Ergebnis der jeweiligen Tabelle.
function fake(
  ergebnisse: Record<string, { data?: unknown; error?: unknown } | Error> = {},
  user: { id: string } | null = { id: "u1" },
) {
  const aufrufe: [string, unknown[]][] = [];
  const kette = (tabelle: string): object =>
    new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then") {
            const e = ergebnisse[tabelle] ?? { data: null, error: null };
            return (ok: (v: unknown) => unknown, fehler: (e: unknown) => unknown) =>
              (e instanceof Error ? Promise.reject(e) : Promise.resolve(e)).then(ok, fehler);
          }
          return (...args: unknown[]) => {
            aufrufe.push([String(prop), args]);
            return kette(tabelle);
          };
        },
      },
    );
  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: (tabelle: string) => {
      aufrufe.push(["from", [tabelle]]);
      return kette(tabelle);
    },
  };
  return { client: client as never, aufrufe };
}

const mitB = { consents: { data: [{ kind: "B", revoked_at: null }], error: null } };
// Lokale Zeit wie auf dem Gerät: new Date(J, M, T, h, m) ist unabhängig von der Zeitzone des Testlaufs.
const lokal = (tag: number, h: number, m: number) => new Date(2026, 10, tag, h, m).toISOString();

describe("tagessumme", () => {
  test("ohne Einträge ist die Summe 0", () => {
    expect(tagessumme([], new Date(2026, 10, 10, 12, 0))).toBe(0);
  });

  test("Tagesgrenze ist 00:00 lokal: 23:59 zählt zum Vortag, 00:01 zum neuen Tag", () => {
    const eintraege = [
      { amount_ml: 250, logged_at: lokal(9, 23, 59) },
      { amount_ml: 500, logged_at: lokal(10, 0, 1) },
      { amount_ml: 300, logged_at: lokal(10, 18, 30) },
    ];
    expect(tagessumme(eintraege, new Date(2026, 10, 10, 20, 0))).toBe(800);
    expect(tagessumme(eintraege, new Date(2026, 10, 9, 8, 0))).toBe(250);
  });
});

describe("letzteTage", () => {
  test("liefert 7 Tage, ältester zuerst, heute zuletzt, leere Tage mit 0", () => {
    const tage = letzteTage([{ amount_ml: 250, logged_at: lokal(9, 23, 59) }, { amount_ml: 500, logged_at: lokal(10, 0, 1) }], new Date(2026, 10, 10, 12, 0));
    expect(tage).toHaveLength(7);
    expect(tage.map((t) => t.summe)).toEqual([0, 0, 0, 0, 0, 250, 500]);
    expect(tage[6].tag.getDate()).toBe(10);
    expect(tage[0].tag.getDate()).toBe(4);
  });
});

describe("istGueltigeMenge", () => {
  test.each([
    [1, true],
    [250, true],
    [5000, true],
    [0, false],
    [5001, false],
    [-250, false],
    [12.5, false],
    [Number.NaN, false],
  ])("%s ml → %s", (ml, gueltig) => {
    expect(istGueltigeMenge(ml)).toBe(gueltig);
  });
});

describe("trageWasserEin", () => {
  test("fügt genau einen Eintrag mit der Menge ein und liefert die Zeile zurück", async () => {
    const zeile = { id: "w1", amount_ml: 250, logged_at: "2026-11-10T10:00:00Z" };
    const { client, aufrufe } = fake({ ...mitB, water_logs: { data: zeile, error: null } });
    expect(await trageWasserEin(client, 250)).toEqual({ ok: true, daten: zeile });
    const inserts = aufrufe.filter(([m]) => m === "insert");
    expect(inserts).toEqual([["insert", [{ user_id: "u1", amount_ml: 250 }]]]);
  });

  test("mit Client-id (Offline-Warteschlange, Art „wasser“) wird genau diese id geschrieben", async () => {
    const eintrag = neuerEintrag("wasser", { ml: 500 });
    const { client, aufrufe } = fake({ ...mitB, water_logs: { data: null, error: null } });
    await trageWasserEin(client, 500, { id: eintrag.id });
    expect(aufrufe.filter(([m]) => m === "insert")).toEqual([["insert", [{ id: eintrag.id, user_id: "u1", amount_ml: 500 }]]]);
  });

  test.each([0, 5001])("lehnt %s ml ab, ohne zu schreiben", async (ml) => {
    const { client, aufrufe } = fake(mitB);
    expect(await trageWasserEin(client, ml)).toEqual({ ok: false, fehler: "ungueltig" });
    expect(aufrufe.some(([m]) => m === "insert")).toBe(false);
  });

  test("schreibt ohne offene Einwilligung B nichts", async () => {
    const { client, aufrufe } = fake({ consents: { data: [{ kind: "B", revoked_at: "2026-11-01T10:00:00Z" }], error: null } });
    expect(await trageWasserEin(client, 250)).toEqual({ ok: false, fehler: "keine_einwilligung" });
    expect(aufrufe.some(([m]) => m === "insert")).toBe(false);
  });

  test("ohne Anmeldung kein Schreiben", async () => {
    const { client, aufrufe } = fake(mitB, null);
    expect(await trageWasserEin(client, 250)).toEqual({ ok: false, fehler: "no_user" });
    expect(aufrufe.some(([m]) => m === "insert")).toBe(false);
  });

  test("Datenbank- und Netzfehler kommen als Ergebnis zurück", async () => {
    expect(await trageWasserEin(fake({ ...mitB, water_logs: { data: null, error: { code: "42501" } } }).client, 250)).toEqual({
      ok: false,
      fehler: "42501",
    });
    expect(await trageWasserEin(fake({ ...mitB, water_logs: new TypeError("Failed to fetch") }).client, 250)).toEqual({
      ok: false,
      fehler: "netz",
    });
  });
});

describe("loescheWasser und wasserSeit", () => {
  test("löscht genau den Eintrag mit der id", async () => {
    const { client, aufrufe } = fake();
    expect(await loescheWasser(client, "w1")).toEqual({ ok: true, daten: null });
    expect(aufrufe).toContainEqual(["from", ["water_logs"]]);
    expect(aufrufe).toContainEqual(["delete", []]);
    expect(aufrufe).toContainEqual(["eq", ["id", "w1"]]);
  });

  test("liest Einträge ab einem Zeitpunkt, neueste zuerst", async () => {
    const { client, aufrufe } = fake({ water_logs: { data: [], error: null } });
    expect(await wasserSeit(client, "2026-11-03T00:00:00.000Z")).toEqual({ ok: true, daten: [] });
    expect(aufrufe).toContainEqual(["gte", ["logged_at", "2026-11-03T00:00:00.000Z"]]);
    expect(aufrufe).toContainEqual(["order", ["logged_at", { ascending: false }]]);
  });
});
