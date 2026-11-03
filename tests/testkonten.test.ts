import { describe, expect, test } from "vitest";
import { TESTKONTEN, befuelleTestkonten, waterRows, type KontoDb, type Row } from "../lib/testkonten";

// In-Memory-Datenbank mit RLS-Nachbau: Jedes Konto sieht und ändert nur Zeilen mit eigener user_id.
function datenbank(fremd: Row[], tabellen = ["water_logs"]) {
  const store: Row[] = [...fremd];
  const als = (userId: string): KontoDb => ({
    userId,
    exists: async (t) => tabellen.includes(t),
    list: async () => store.filter((r) => r.user_id === userId),
    replace: async (_t, rows) => {
      for (let i = store.length - 1; i >= 0; i--) if (store[i].user_id === userId) store.splice(i, 1);
      store.push(...rows.filter((r) => r.user_id === userId));
    },
  });
  return { store, als };
}

const jetzt = new Date("2026-11-03T10:00:00Z");
const fremd: Row[] = [{ user_id: "anderer", amount_ml: 250, logged_at: "2026-11-01T08:00:00.000Z" }];

describe("Testkonten", () => {
  test("sieben Tage Verlauf, nur Zeilen des Kontos", () => {
    const rows = waterRows("a", jetzt);
    expect(rows).toHaveLength(21);
    expect(new Set(rows.map((r) => (r.logged_at as string).slice(0, 10))).size).toBe(7);
    expect(rows.every((r) => r.user_id === "a")).toBe(true);
  });

  test("ändert keine Daten anderer Konten und ist idempotent", async () => {
    const db = datenbank(fremd);
    await befuelleTestkonten(db.als("a"), db.als("b"), jetzt);
    const nachEinmal = JSON.stringify(db.store);
    await befuelleTestkonten(db.als("a"), db.als("b"), jetzt);
    expect(JSON.stringify(db.store)).toBe(nachEinmal);
    expect(db.store.filter((r) => r.user_id === "anderer")).toEqual(fremd);
    expect(db.store.filter((r) => r.user_id === "a")).toHaveLength(21);
  });

  test("zweites Konto sieht nichts vom ersten", async () => {
    const db = datenbank(fremd);
    const r = await befuelleTestkonten(db.als("a"), db.als("b"), jetzt);
    expect(r.zweitesSiehtFremde).toBe(0);
    expect(await db.als("b").list("water_logs")).toEqual([]);
  });

  test("fehlende Tabellen werden übersprungen und genannt", async () => {
    const db = datenbank(fremd, []);
    const r = await befuelleTestkonten(db.als("a"), db.als("b"), jetzt);
    expect(r.gefuellt).toEqual([]);
    expect(r.uebersprungen).toEqual(expect.arrayContaining(["Plan", "Trainings", "Essen", "Schlaf", "Wasser"]));
  });

  test("fasst nur die zwei festen Testkonten an", () => {
    expect(Object.values(TESTKONTEN)).toEqual(["sinan-test@sjcode.de", "sinan-test-2@sjcode.de"]);
  });
});
