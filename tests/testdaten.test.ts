import { describe, expect, test } from "vitest";
import {
  befuellen,
  leeren,
  TESTKONTO_1,
  TESTKONTO_2,
  type SeedClient,
} from "../lib/testdaten/seed.ts";

type Row = Record<string, unknown>;

// Speicher-Datenbank; nur water_logs und profiles existieren, alles andere meldet „Tabelle fehlt“ wie PostgREST.
function fakeDb(initial: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = { profiles: [], water_logs: [], ...initial };
  const missing = { code: "PGRST205", message: "Could not find the table" };
  const db: SeedClient = {
    select: async (t) => ({ error: t in tables ? null : missing }),
    deleteAll: async (t, userId) => {
      if (!(t in tables)) return { error: missing };
      tables[t] = tables[t].filter((r) => r.user_id !== userId);
      return { error: null };
    },
    insert: async (t, rows) => {
      if (!(t in tables)) return { error: missing };
      tables[t].push(...rows.map((r) => ({ ...r })));
      return { error: null };
    },
    upsert: async (t, row) => {
      tables[t] = tables[t].filter((r) => r.id !== row.id);
      tables[t].push({ ...row });
      return { error: null };
    },
  };
  return { db, tables };
}

const heute = new Date("2026-11-03T10:00:00Z");
const konto1 = { email: TESTKONTO_1, userId: "u1" };
const fremd = [
  { id: "x1", user_id: "fremd", amount_ml: 777, logged_at: "2026-11-01T08:00:00.000Z" },
  { id: "x2", user_id: "u2", amount_ml: 123, logged_at: "2026-11-02T08:00:00.000Z" },
];

describe("befuellen", () => {
  test("ändert keine Daten anderer Konten", async () => {
    const { db, tables } = fakeDb({ water_logs: fremd.map((r) => ({ ...r })) });
    await befuellen(db, konto1, heute);
    expect(tables.water_logs.filter((r) => r.user_id !== "u1")).toEqual(fremd);
    expect(tables.profiles.map((p) => p.id)).toEqual(["u1"]);
  });

  test("zweimal ausführen ergibt denselben Stand", async () => {
    const { db, tables } = fakeDb({ water_logs: fremd.map((r) => ({ ...r })) });
    await befuellen(db, konto1, heute);
    const erster = JSON.stringify(tables);
    await befuellen(db, konto1, heute);
    expect(JSON.stringify(tables)).toBe(erster);
    expect(tables.water_logs.filter((r) => r.user_id === "u1")).toHaveLength(28);
  });

  test("deckt sieben Tage ab, nennt fehlende Tabellen und überspringt sie", async () => {
    const { db, tables } = fakeDb();
    const bericht = await befuellen(db, konto1, heute);
    const tage = new Set(tables.water_logs.map((r) => String(r.logged_at).slice(0, 10)));
    expect(tage.size).toBe(7);
    expect(bericht.uebersprungen.join(" ")).toMatch(/training_plans.*existiert noch nicht/);
    expect(bericht.uebersprungen.join(" ")).toMatch(/sleep_logs/);
  });

  test("Konto 2 bekommt keine Verlaufsdaten und lässt Konto 1 unberührt", async () => {
    const { db, tables } = fakeDb();
    await befuellen(db, konto1, heute);
    const vorher = tables.water_logs.filter((r) => r.user_id === "u1");
    await befuellen(db, { email: TESTKONTO_2, userId: "u2" }, heute);
    expect(tables.water_logs.filter((r) => r.user_id === "u2")).toEqual([]);
    expect(tables.water_logs.filter((r) => r.user_id === "u1")).toEqual(vorher);
  });

  test("lehnt fremde E-Mail-Adressen ab", async () => {
    const { db, tables } = fakeDb();
    await expect(befuellen(db, { email: "jemand@example.com", userId: "u9" }, heute)).rejects.toThrow(/kein Testkonto/);
    await expect(leeren(db, { email: "jemand@example.com", userId: "u9" })).rejects.toThrow(/kein Testkonto/);
    expect(tables.profiles).toEqual([]);
  });
});

test("leeren entfernt nur die Zeilen des Kontos", async () => {
  const { db, tables } = fakeDb({ water_logs: fremd.map((r) => ({ ...r })) });
  await befuellen(db, konto1, heute);
  await leeren(db, konto1);
  expect(tables.water_logs).toEqual(fremd);
});
