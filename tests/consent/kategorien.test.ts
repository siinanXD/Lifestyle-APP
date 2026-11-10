import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { PROFILANGABEN_A, TABELLEN, widerrufe } from "../../lib/consent/kategorien";

// Schema aus den Migrationen: jede Tabelle, die eine Migration anlegt.
const tabellenAusMigrationen = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .flatMap((f) => [...readFileSync(`supabase/migrations/${f}`, "utf8").matchAll(/create table lifestyle\.(\w+)/gi)].map((m) => m[1]));

describe("Zuordnung Tabelle → Einwilligung", () => {
  const zugeordnet = Object.values(TABELLEN).flat();

  test("jede Tabelle aus den Migrationen ist genau einmal zugeordnet (schlägt bei neuen Tabellen an)", () => {
    expect(tabellenAusMigrationen.length).toBeGreaterThan(0);
    for (const t of tabellenAusMigrationen) expect(zugeordnet.filter((z) => z === t), t).toHaveLength(1);
  });

  test("keine zugeordnete Tabelle fehlt in den Migrationen", () => {
    for (const t of zugeordnet) expect(tabellenAusMigrationen, t).toContain(t);
  });

  test("Gesundheitsdaten-Tabellen gehören zu B", () => {
    expect(TABELLEN.B).toEqual(expect.arrayContaining(["health_profile", "workouts", "workout_sets", "water_logs", "body_measurements", "training_plans", "plan_items", "activity_logs", "comeback_checkins", "sleep_logs", "meals"]));
  });

  test("A setzt nur Profilangaben zurück, nicht die Kontozeile", () => {
    expect(Object.keys(PROFILANGABEN_A).sort()).toEqual(["days_per_week", "equipment", "experience", "goal_note", "goals", "minutes_per_session"]);
    expect(TABELLEN.immer).toEqual(expect.arrayContaining(["profiles", "consents"]));
  });
});

// Kette wie im Supabase-Client; zeichnet jeden Aufruf mit Tabelle auf.
function fake({ fehlerBei, user = { id: "u1" } }: { fehlerBei?: string; user?: { id: string } | null } = {}) {
  const aufrufe: { tabelle: string; methode: string; args: unknown[] }[] = [];
  const kette = (tabelle: string): object =>
    new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then") {
            const error = tabelle === fehlerBei ? { code: "42501" } : null;
            return (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error }).then(ok);
          }
          return (...args: unknown[]) => {
            aufrufe.push({ tabelle, methode: String(prop), args });
            return kette(tabelle);
          };
        },
      },
    );
  const client = { auth: { getUser: async () => ({ data: { user } }) }, from: (t: string) => kette(t) };
  return { client: client as never, aufrufe };
}

const loeschungen = (aufrufe: ReturnType<typeof fake>["aufrufe"]) => aufrufe.filter((a) => a.methode === "delete").map((a) => a.tabelle);
const widerruf = (aufrufe: ReturnType<typeof fake>["aufrufe"]) =>
  aufrufe.filter((a) => a.tabelle === "consents" && a.methode === "update");

describe("widerrufe", () => {
  test("ohne „Daten löschen“: nur der Widerruf, Daten bleiben", async () => {
    const { client, aufrufe } = fake();
    expect(await widerrufe(client, "B", { datenLoeschen: false })).toEqual({ error: null, widerrufen: true });
    expect(loeschungen(aufrufe)).toEqual([]);
    expect(widerruf(aufrufe)).toHaveLength(1);
    expect(aufrufe).toContainEqual({ tabelle: "consents", methode: "eq", args: ["kind", "B"] });
  });

  test("mit „Daten löschen“: erst der Widerruf, dann alle B-Tabellen der eigenen Person, Sätze vor Trainings", async () => {
    const { client, aufrufe } = fake();
    expect(await widerrufe(client, "B", { datenLoeschen: true })).toEqual({ error: null, widerrufen: true });
    expect(loeschungen(aufrufe)).toEqual(TABELLEN.B);
    expect(TABELLEN.B.indexOf("workout_sets")).toBeLessThan(TABELLEN.B.indexOf("workouts"));
    expect(TABELLEN.B.indexOf("plan_items")).toBeLessThan(TABELLEN.B.indexOf("training_plans"));
    for (const t of TABELLEN.B) expect(aufrufe).toContainEqual({ tabelle: t, methode: "eq", args: ["user_id", "u1"] });
    // Regression: Ein zweites Fenster darf nach dem Leeren von workouts kein Training mehr starten können.
    // Dafür muss der Widerruf vor dem ersten Löschen stehen (die Datenbank lehnt Schreiben ohne offene Einwilligung B ab).
    expect(aufrufe.findIndex((a) => a.tabelle === "consents" && a.methode === "update")).toBeLessThan(aufrufe.findIndex((a) => a.methode === "delete"));
  });

  test("A mit „Daten löschen“ setzt die Profilangaben der eigenen Zeile zurück und löscht die Gewohnheiten", async () => {
    const { client, aufrufe } = fake();
    await widerrufe(client, "A", { datenLoeschen: true });
    expect(aufrufe).toContainEqual({ tabelle: "profiles", methode: "update", args: [PROFILANGABEN_A] });
    expect(aufrufe).toContainEqual({ tabelle: "profiles", methode: "eq", args: ["id", "u1"] });
    expect(loeschungen(aufrufe)).toEqual(["habit_checks", "habits"]);
    expect(widerruf(aufrufe)).toHaveLength(1);
  });

  test("schlägt das Löschen fehl, ist widerrufen und der Zwischenstand wird gemeldet", async () => {
    const { client, aufrufe } = fake({ fehlerBei: "workouts" });
    expect(await widerrufe(client, "B", { datenLoeschen: true })).toEqual({ error: { code: "42501" }, widerrufen: true });
    expect(widerruf(aufrufe)).toHaveLength(1);
    expect(loeschungen(aufrufe)).toEqual(["workout_sets", "workouts"]);
  });

  test("schlägt der Widerruf fehl, wird nichts gelöscht", async () => {
    const { client, aufrufe } = fake({ fehlerBei: "consents" });
    expect(await widerrufe(client, "B", { datenLoeschen: true })).toEqual({ error: { code: "42501" }, widerrufen: false });
    expect(loeschungen(aufrufe)).toEqual([]);
  });

  test("ohne Anmeldung passiert nichts", async () => {
    const { client, aufrufe } = fake({ user: null });
    expect(await widerrufe(client, "B", { datenLoeschen: true })).toEqual({ error: { code: "no_user" }, widerrufen: false });
    expect(aufrufe).toEqual([]);
  });
});
