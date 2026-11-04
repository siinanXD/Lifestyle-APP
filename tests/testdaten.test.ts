import { describe, expect, test } from "vitest";
import { TESTKONTO_1, TESTKONTO_2, anmelden, seedAccount, type AuthClient, type SeedClient } from "../lib/testdaten/seed";

type Row = Record<string, unknown>;
const ok = { error: null };

// In-Memory-Attrappe mit RLS-Verhalten: Der Client sieht und ändert nur Zeilen seiner user_id.
function clientFor(rows: Row[], uid: string, missing = false): SeedClient {
  const run = (pred: (r: Row) => boolean) => {
    if (missing) return Promise.resolve({ error: { code: "42P01", message: "relation does not exist" } });
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].user_id === uid && pred(rows[i])) rows.splice(i, 1);
    return Promise.resolve(ok);
  };
  return {
    from: () => ({
      delete: () => ({
        eq: (_c: string, v: string) => run((r) => r.user_id === v),
        in: (c: string, v: string[]) => run((r) => v.includes(String(r[c]))),
      }),
      insert: (n: Row[]) => {
        if (n.some((r) => r.user_id !== uid)) return Promise.resolve({ error: { message: "RLS" } });
        rows.push(...n);
        return Promise.resolve(ok);
      },
    }),
  };
}

const today = new Date("2026-11-03T12:00:00Z");
const fremd: Row = { user_id: "fremd", amount_ml: 999, logged_at: "2026-11-03T08:00:00.000Z" };

describe("Testdaten-Skript", () => {
  test("zweimal seed ergibt denselben Stand und lässt fremde Zeilen unangetastet", async () => {
    const rows: Row[] = [{ ...fremd }];
    const c = clientFor(rows, "u1");
    await seedAccount(c, { email: TESTKONTO_1, userId: "u1", mode: "seed", today });
    const erst = JSON.stringify(rows);
    const res = await seedAccount(c, { email: TESTKONTO_1, userId: "u1", mode: "seed", today });
    expect(JSON.stringify(rows)).toBe(erst);
    expect(res.seeded.water_logs).toBe(42);
    expect(rows.filter((r) => r.user_id === "fremd")).toEqual([fremd]);
  });

  test("reset stellt den Anfangsstand wieder her", async () => {
    const rows: Row[] = [];
    const c = clientFor(rows, "u1");
    await seedAccount(c, { email: TESTKONTO_1, userId: "u1", mode: "seed", today });
    const anfang = JSON.stringify(rows);
    rows.push({ user_id: "u1", amount_ml: 1, logged_at: "2026-11-01T01:00:00.000Z" });
    await seedAccount(c, { email: TESTKONTO_1, userId: "u1", mode: "reset", today });
    expect(JSON.stringify(rows)).toBe(anfang);
  });

  test("zweites Konto bleibt leer und fasst das erste nicht an", async () => {
    const rows: Row[] = [];
    await seedAccount(clientFor(rows, "u1"), { email: TESTKONTO_1, userId: "u1", mode: "seed", today });
    const vorher = JSON.stringify(rows);
    await seedAccount(clientFor(rows, "u2"), { email: TESTKONTO_2, userId: "u2", mode: "seed", today });
    await seedAccount(clientFor(rows, "u2"), { email: TESTKONTO_2, userId: "u2", mode: "reset", today });
    expect(JSON.stringify(rows)).toBe(vorher);
  });

  test("fehlende Tabelle wird übersprungen und genannt; fremde Konten werden abgelehnt", async () => {
    const res = await seedAccount(clientFor([], "u1", true), { email: TESTKONTO_1, userId: "u1", mode: "seed", today });
    expect(res.skipped).toEqual(expect.arrayContaining(["water_logs", "Plan", "Schlaf"]));
    await expect(
      seedAccount(clientFor([], "x"), { email: "jemand@example.com", userId: "x", mode: "seed" }),
    ).rejects.toThrow();
  });
});

describe("Testdaten-Skript: Fehler werden nicht verschluckt", () => {
  test("ein anderer Fehler als „Relation fehlt“ bricht ab statt übersprungen zu werden", async () => {
    const c: SeedClient = {
      from: () => ({
        delete: () => ({
          eq: () => Promise.resolve({ error: { code: "42501", message: "permission denied" } }),
          in: () => Promise.resolve({ error: { code: "42501", message: "permission denied" } }),
        }),
        insert: () => Promise.resolve({ error: null }),
      }),
    };
    await expect(seedAccount(c, { email: TESTKONTO_1, userId: "u1", mode: "seed", today })).rejects.toThrow("permission denied");
  });

  const fehler = (code: string) => ({ data: { user: null, session: null }, error: { code, message: code } });
  const erfolg = { data: { user: { id: "u2" }, session: {} }, error: null };
  const auth = (login: unknown, up: unknown = erfolg) => {
    const calls = { signUp: 0 };
    const a = {
      signInWithPassword: () => Promise.resolve(login),
      signUp: () => (calls.signUp++, Promise.resolve(up)),
    } as unknown as AuthClient;
    return { a, calls };
  };

  test("signUp nur bei invalid_credentials und nur für Konto 2", async () => {
    const { a, calls } = auth(fehler("invalid_credentials"));
    await expect(anmelden(a, TESTKONTO_2, "pw")).resolves.toBe("u2");
    expect(calls.signUp).toBe(1);

    const k1 = auth(fehler("invalid_credentials"));
    await expect(anmelden(k1.a, TESTKONTO_1, "pw")).rejects.toThrow("Anmeldung fehlgeschlagen");
    const netz = auth(fehler("over_request_rate_limit"));
    await expect(anmelden(netz.a, TESTKONTO_2, "pw")).rejects.toThrow("Anmeldung fehlgeschlagen");
    expect(k1.calls.signUp + netz.calls.signUp).toBe(0);
  });

  test("signUp ohne Sitzung (Bestätigung nötig oder fremdes Passwort) wird gemeldet", async () => {
    const { a } = auth(fehler("invalid_credentials"), { data: { user: { id: "u2" }, session: null }, error: null });
    await expect(anmelden(a, TESTKONTO_2, "pw")).rejects.toThrow("E-Mail-Bestätigung");
  });
});
