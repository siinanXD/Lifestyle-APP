import { describe, expect, test } from "vitest";
import { KONTO_1, KONTO_2, run } from "../scripts/testdaten.mjs";

// Fake-Supabase im Speicher: Token bestimmt den Nutzer; Policies wie in der Migration (nur eigene Zeilen).
// Tabellen training_plans, workouts, meals, sleep_logs fehlen (404).
type Row = { user_id: string; amount_ml: number; logged_at: string };

function fakeSupabase() {
  const users: Record<string, string> = { [KONTO_1]: "u1", [KONTO_2]: "u2", "fremd@example.test": "u3" };
  const fremd: Row = { user_id: "u3", amount_ml: 999, logged_at: "2026-01-01T00:00:00.000Z" };
  const water: Row[] = [{ ...fremd }];
  const profiles: Record<string, string> = { u3: "Fremd" };
  const calls: string[] = [];
  const json = (b: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(b), { status });

  const fake = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url.pathname}`);
    if (url.pathname === "/auth/v1/token") {
      const { email } = JSON.parse(String(init!.body));
      return users[email] ? json({ access_token: `t-${users[email]}`, user: { id: users[email] } }) : json({}, 400);
    }
    const me = String((init!.headers as Record<string, string>).Authorization).replace("Bearer t-", "");
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url.pathname === "/rest/v1/profiles") {
      if (body.id !== me) return json({}, 403);
      profiles[me] = body.display_name;
      return json({}, 201);
    }
    if (url.pathname === "/rest/v1/water_logs") {
      if (method === "DELETE") {
        // RLS: nur eigene Zeilen sind sichtbar, auch bei einem Filter auf fremde Zeilen.
        for (let i = water.length - 1; i >= 0; i--) if (water[i].user_id === me) water.splice(i, 1);
        return json({}, 204);
      }
      if (body.some((r: Row) => r.user_id !== me)) return json({}, 403);
      water.push(...body);
      return json({}, 201);
    }
    return json({ code: "PGRST205" }, 404);
  };
  return { fetch: fake as typeof globalThis.fetch, water, profiles, calls, fremd };
}

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "http://sb.test",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  TESTNUTZER_PASSWORT: "pw1",
  TESTNUTZER2_PASSWORT: "pw2",
};
const jetzt = new Date("2026-11-03T10:00:00Z");
const stand = (water: Row[]) =>
  JSON.stringify([...water].sort((a, b) => (a.user_id + a.logged_at).localeCompare(b.user_id + b.logged_at)));

describe("Testdaten-Skript", () => {
  test("ändert keine Daten anderer Konten", async () => {
    const sb = fakeSupabase();
    await run({ env, fetch: sb.fetch, jetzt, log: () => {} });
    expect(sb.water.filter((r) => r.user_id === "u3")).toEqual([sb.fremd]);
    expect(sb.profiles.u3).toBe("Fremd");
  });

  test("zweimal ausführen ergibt denselben Stand", async () => {
    const sb = fakeSupabase();
    await run({ env, fetch: sb.fetch, jetzt, log: () => {} });
    const erst = stand(sb.water);
    await run({ env, fetch: sb.fetch, jetzt, modus: "reset", log: () => {} });
    expect(stand(sb.water)).toBe(erst);
    expect(sb.water.filter((r) => r.user_id === "u1")).toHaveLength(28);
  });

  test("nennt fehlende Tabellen statt zu scheitern", async () => {
    const sb = fakeSupabase();
    const ergebnis = await run({ env, fetch: sb.fetch, jetzt, log: () => {} });
    expect(ergebnis[KONTO_1]).toContain("sleep_logs: übersprungen (Tabelle fehlt noch)");
  });

  test("lehnt fremde E-Mail-Adressen ab, ohne etwas anzufassen", async () => {
    const sb = fakeSupabase();
    await expect(
      run({ env: { ...env, TESTNUTZER_EMAIL: "fremd@example.test" }, fetch: sb.fetch, jetzt, log: () => {} }),
    ).rejects.toThrow(/kein Testkonto/);
    expect(sb.calls).toEqual([]);
  });

  test("das zweite Konto bekommt andere Daten als das erste", async () => {
    const sb = fakeSupabase();
    await run({ env, fetch: sb.fetch, jetzt, log: () => {} });
    const u2 = sb.water.filter((r) => r.user_id === "u2");
    expect(u2).toHaveLength(1);
    expect(sb.water.filter((r) => r.user_id === "u1").map((r) => r.logged_at)).not.toContain(u2[0].logged_at);
  });
});
