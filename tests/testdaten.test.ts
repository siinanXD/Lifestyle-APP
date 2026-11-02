import { describe, expect, test } from "vitest";
// @ts-expect-error reines JS-Skript
import { seedKonto, wasserZeilen, ERLAUBTE_EMAILS } from "../scripts/testdaten.mjs";

type Row = Record<string, unknown>;

// Fake-DB mit RLS-Verhalten: delete/insert wirken nur auf Zeilen des Aufrufers (eq user_id).
function fakeDb(store: Record<string, Row[]>, missing: string[] = []) {
  return {
    from(t: string) {
      const err = missing.includes(t) ? { code: "PGRST205" } : null;
      return {
        upsert: async (row: Row) => {
          store[t] = [...(store[t] ?? []).filter((r) => r.id !== row.id), row];
          return { error: null };
        },
        delete: () => ({
          eq: async (_c: string, id: string) => {
            if (!err) store[t] = (store[t] ?? []).filter((r) => r.user_id !== id);
            return { error: err };
          },
        }),
        insert: async (rows: Row[]) => {
          store[t] = [...(store[t] ?? []), ...rows];
          return { error: err };
        },
        select: async () => ({ error: { code: "PGRST205" } }),
      };
    },
  };
}
const heute = new Date("2026-11-02T12:00:00Z");

describe("testdaten", () => {
  test("zweimal ausführen ergibt denselben Stand und fremde Zeilen bleiben unberührt", async () => {
    const fremd = { user_id: "fremd", amount_ml: 123, logged_at: "2026-10-01T00:00:00Z" };
    const store: Record<string, Row[]> = { water_logs: [fremd], profiles: [{ id: "fremd", display_name: "X" }] };
    const db = fakeDb(store);
    await seedKonto(db, "u1", "Sinan Test", { heute });
    const einmal = JSON.stringify(store);
    await seedKonto(db, "u1", "Sinan Test", { heute });
    expect(JSON.stringify(store)).toBe(einmal);
    expect(store.water_logs).toContainEqual(fremd);
    expect(store.profiles).toContainEqual({ id: "fremd", display_name: "X" });
    expect(store.water_logs.filter((r) => r.user_id === "u1")).toHaveLength(wasserZeilen("u1", heute).length);
  });

  test("Reset stellt den Anfangsstand wieder her", async () => {
    const store: Record<string, Row[]> = {};
    const db = fakeDb(store);
    await seedKonto(db, "u1", "A", { heute });
    const soll = JSON.stringify(store);
    store.water_logs.push({ user_id: "u1", amount_ml: 1, logged_at: "x" });
    await seedKonto(db, "u1", "A", { heute });
    expect(JSON.stringify(store)).toBe(soll);
  });

  test("fehlende Tabellen werden übersprungen und genannt; sieben Tage Verlauf", async () => {
    const b = await seedKonto(fakeDb({}, ["water_logs"]), "u1", "A", { heute });
    expect(b.uebersprungen).toContain("water_logs");
    expect(b.uebersprungen).toContain("Plan (Tabelle fehlt)");
    const tage = new Set(wasserZeilen("u1", heute).map((r: { logged_at: string }) => r.logged_at.slice(0, 10)));
    expect(tage.size).toBe(7);
  });

  test("nur die beiden Testkonten sind erlaubt", () => {
    expect(ERLAUBTE_EMAILS).toEqual(["sinan-test@sjcode.de", "sinan-test-2@sjcode.de"]);
  });
});
