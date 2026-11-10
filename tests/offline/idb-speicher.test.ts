import { describe, expect, test } from "vitest";
import { idbSpeicher } from "../../lib/offline/idb-speicher";
import type { Eintrag } from "../../lib/offline/queue";

// Kleine Eigen-Attrappe der IndexedDB-API (kein fake-indexeddb): nur was idb-speicher.ts benutzt.
// Anfragen melden sich wie im Browser asynchron; die Transaktion schließt ab, wenn keine Anfrage mehr offen ist.
function attrappe() {
  const stores = new Map<string, Map<string, unknown>>();
  const upgrades: string[] = [];
  type Anfrage = { result?: unknown; error: null; onsuccess?: () => void; onupgradeneeded?: () => void };

  const factory = {
    open(name: string) {
      const anfrage: Anfrage = { error: null };
      const db = {
        createObjectStore: (store: string, optionen: { keyPath: string }) => {
          upgrades.push(`${name}/${store}/${optionen.keyPath}`);
          stores.set(`${name}/${store}`, new Map());
        },
        transaction(store: string) {
          const zeilen = stores.get(`${name}/${store}`)!;
          let offen = 0;
          const tx: { error: null; oncomplete?: () => void } = { error: null };
          const op = (lauf: () => unknown) => {
            const a: Anfrage = { error: null };
            offen++;
            queueMicrotask(() => {
              a.result = lauf();
              a.onsuccess?.();
              if (--offen === 0) queueMicrotask(() => tx.oncomplete?.());
            });
            return a;
          };
          const objectStore = {
            getAll: () => op(() => [...zeilen.values()].map((z) => structuredClone(z))),
            get: (id: string) => op(() => zeilen.get(id)),
            put: (e: { id: string }) => op(() => void zeilen.set(e.id, structuredClone(e))),
            delete: (id: string) => op(() => void zeilen.delete(id)),
            clear: () => op(() => zeilen.clear()),
          };
          return Object.assign(tx, { objectStore: () => objectStore });
        },
      };
      queueMicrotask(() => {
        anfrage.result = db;
        if (!stores.has(`${name}/queue`)) anfrage.onupgradeneeded?.();
        anfrage.onsuccess?.();
      });
      return anfrage;
    },
  };
  return { factory: factory as never, upgrades };
}

const eintrag = (id: string, mehr: Partial<Eintrag> = {}): Eintrag => ({
  id,
  art: "satz",
  daten: { satzNr: 1 },
  erstelltAm: "2026-01-01T10:00:00.000Z",
  versuche: 0,
  ...mehr,
});

describe("idbSpeicher", () => {
  test("legt Datenbank lifestyle-offline mit Store queue (Schlüssel id) genau einmal an", async () => {
    const { factory, upgrades } = attrappe();
    await idbSpeicher(factory).alle();
    await idbSpeicher(factory).alle();
    expect(upgrades).toEqual(["lifestyle-offline/queue/id"]);
  });

  test("hinzufuegen, alle, aktualisieren, entfernen; Daten überleben einen Neustart", async () => {
    const { factory } = attrappe();
    const speicher = idbSpeicher(factory);
    await speicher.hinzufuegen(eintrag("a"));
    await speicher.hinzufuegen(eintrag("b"));
    await speicher.aktualisieren(eintrag("a", { versuche: 2 }));
    expect(await idbSpeicher(factory).alle()).toEqual([eintrag("a", { versuche: 2 }), eintrag("b")]);

    await speicher.entfernen("a");
    expect(await speicher.alle()).toEqual([eintrag("b")]);
  });

  test("dieselbe id zweimal hinzugefügt bleibt ein Eintrag", async () => {
    const speicher = idbSpeicher(attrappe().factory);
    await speicher.hinzufuegen(eintrag("a"));
    await speicher.hinzufuegen(eintrag("a"));
    expect(await speicher.alle()).toHaveLength(1);
  });

  test("aktualisieren legt einen entfernten Eintrag nicht wieder an", async () => {
    const speicher = idbSpeicher(attrappe().factory);
    await speicher.aktualisieren(eintrag("weg", { versuche: 1 }));
    expect(await speicher.alle()).toEqual([]);
  });

  test("leeren() entfernt alles", async () => {
    const { factory } = attrappe();
    const speicher = idbSpeicher(factory);
    await speicher.hinzufuegen(eintrag("a"));
    await speicher.hinzufuegen(eintrag("b", { fehlgeschlagen: "42501" }));
    await speicher.leeren();
    expect(await idbSpeicher(factory).alle()).toEqual([]);
  });
});

describe("idbSpeicher: bedingtes Entfernen und Ändern", () => {
  test("mit nurWenn wird nur die unveränderte Fassung entfernt oder geändert", async () => {
    const speicher = idbSpeicher(attrappe().factory);
    const alt = eintrag("a");
    await speicher.hinzufuegen(eintrag("a", { versuche: 3 })); // inzwischen ersetzt
    expect(await speicher.entfernen("a", alt)).toBe(false);
    expect(await speicher.aktualisieren(eintrag("a", { versuche: 9 }), alt)).toBe(false);
    expect(await speicher.alle()).toEqual([eintrag("a", { versuche: 3 })]);

    const aktuell = eintrag("a", { versuche: 3 });
    expect(await speicher.aktualisieren(eintrag("a", { versuche: 4 }), aktuell)).toBe(true);
    expect(await speicher.entfernen("a", eintrag("a", { versuche: 4 }))).toBe(true);
    expect(await speicher.entfernen("a")).toBe(false); // nichts mehr da
    expect(await speicher.alle()).toEqual([]);
  });
});
