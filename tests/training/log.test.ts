import { describe, expect, test } from "vitest";
import {
  alsEinheiten,
  beendeWorkout,
  letzteSaetze,
  loescheSatz,
  speichereSatz,
  starteWorkout,
  tageSeitLetzterEinheit,
  type Satzzeile,
} from "../../lib/training/log";

// Kette wie im Supabase-Client: jede Methode gibt sich selbst zurück, `await` liefert das Ergebnis.
function fake(ergebnis: { data?: unknown; error?: unknown } | Error = { data: null, error: null }, user: { id: string } | null = { id: "u1" }) {
  const aufrufe: [string, unknown[]][] = [];
  const kette: object = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") {
          return (ok: (v: unknown) => unknown, fehler: (e: unknown) => unknown) =>
            (ergebnis instanceof Error ? Promise.reject(ergebnis) : Promise.resolve(ergebnis)).then(ok, fehler);
        }
        return (...args: unknown[]) => {
          aufrufe.push([String(prop), args]);
          return kette;
        };
      },
    },
  );
  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    from: (tabelle: string) => {
      aufrufe.push(["from", [tabelle]]);
      return kette;
    },
  };
  return { client: client as never, aufrufe };
}

const satz = { workoutId: "w1", exerciseId: "rudern", satzNr: 1, wdh: 12, gewichtKg: 20, technik: "sauber" as const, schmerz: false };

describe("speichereSatz", () => {
  test("ist idempotent: gleicher Satz → gleicher Upsert mit gleichem Konfliktschlüssel", async () => {
    const { client, aufrufe } = fake();
    await speichereSatz(client, satz);
    await speichereSatz(client, satz);
    const upserts = aufrufe.filter(([m]) => m === "upsert");
    expect(upserts).toHaveLength(2);
    expect(upserts[0]).toEqual(upserts[1]);
    expect(upserts[0][1]).toEqual([
      { workout_id: "w1", user_id: "u1", exercise_id: "rudern", set_no: 1, reps: 12, weight_kg: 20, technique: "sauber", pain: false },
      { onConflict: "workout_id,set_no,exercise_id" },
    ]);
  });

  test("neuer Satz (nurNeu) fügt ein statt zu überschreiben; Konflikt kommt als 23505 zurück", async () => {
    const { client, aufrufe } = fake({ data: null, error: { code: "23505" } });
    expect(await speichereSatz(client, satz, { nurNeu: true })).toEqual({ ok: false, fehler: "23505" });
    expect(aufrufe.some(([m]) => m === "upsert")).toBe(false);
    expect(aufrufe.find(([m]) => m === "insert")![1]).toEqual([
      { workout_id: "w1", user_id: "u1", exercise_id: "rudern", set_no: 1, reps: 12, weight_kg: 20, technique: "sauber", pain: false },
    ]);
  });

  test("leeres Gewicht wird als Körpergewicht (null) gespeichert", async () => {
    const { client, aufrufe } = fake();
    await speichereSatz(client, { ...satz, gewichtKg: null });
    expect((aufrufe.find(([m]) => m === "upsert")![1][0] as { weight_kg: unknown }).weight_kg).toBeNull();
  });

  test("Fehler der Datenbank liefert ok: false statt Exception", async () => {
    const { client } = fake({ data: null, error: { code: "42501", message: "rls" } });
    expect(await speichereSatz(client, satz)).toEqual({ ok: false, fehler: "42501" });
  });

  test("Netzfehler liefert ok: false statt Exception", async () => {
    const { client } = fake(new TypeError("Failed to fetch"));
    expect(await speichereSatz(client, satz)).toEqual({ ok: false, fehler: "netz" });
  });

  test("ohne Anmeldung nichts schreiben", async () => {
    const { client, aufrufe } = fake(undefined, null);
    expect(await speichereSatz(client, satz)).toEqual({ ok: false, fehler: "no_user" });
    expect(aufrufe).toEqual([]);
  });

  test("negative Wiederholungen werden vor dem Speichern abgelehnt", async () => {
    const { client, aufrufe } = fake();
    expect(await speichereSatz(client, { ...satz, wdh: -1 })).toEqual({ ok: false, fehler: "ungueltig" });
    expect(await speichereSatz(client, { ...satz, gewichtKg: -5 })).toEqual({ ok: false, fehler: "ungueltig" });
    expect(aufrufe).toEqual([]);
  });
});

describe("Workouts", () => {
  test("starteWorkout legt ein eigenes Workout an und liefert die id", async () => {
    const { client, aufrufe } = fake({ data: { id: "w9" }, error: null });
    expect(await starteWorkout(client, { id: "w9" })).toEqual({ ok: true, daten: { id: "w9" } });
    expect(aufrufe[0]).toEqual(["from", ["workouts"]]);
    expect(aufrufe[1]).toEqual(["insert", [{ id: "w9", user_id: "u1", plan_day_id: null }]]);
  });

  test("beendeWorkout setzt ended_at und nur angegebene Felder", async () => {
    const { client, aufrufe } = fake();
    await beendeWorkout(client, "w1", {});
    const [, [werte]] = aufrufe.find(([m]) => m === "update")!;
    expect(Object.keys(werte as object)).toEqual(["ended_at"]);
    await beendeWorkout(client, "w1", { regeneration: "gut" });
    expect((aufrufe.filter(([m]) => m === "update")[1][1][0] as { regeneration: string }).regeneration).toBe("gut");
  });

  test("loescheSatz löscht genau über den Schlüssel", async () => {
    const { client, aufrufe } = fake();
    await loescheSatz(client, { workoutId: "w1", exerciseId: "rudern", satzNr: 2 });
    expect(aufrufe.filter(([m]) => m === "match" || m === "delete")).toEqual([
      ["delete", []],
      ["match", [{ workout_id: "w1", exercise_id: "rudern", set_no: 2 }]],
    ]);
  });

  test("letzteSaetze fragt die Übung, neueste zuerst, mit Limit", async () => {
    const { client, aufrufe } = fake({ data: [], error: null });
    await letzteSaetze(client, "rudern", 5);
    expect(aufrufe).toContainEqual(["eq", ["exercise_id", "rudern"]]);
    expect(aufrufe).toContainEqual(["order", ["created_at", { ascending: false }]]);
    expect(aufrufe).toContainEqual(["limit", [5]]);
  });
});

describe("tageSeitLetzterEinheit", () => {
  const jetzt = new Date("2026-11-06T12:00:00Z");
  test("heute → 0", async () => {
    const { client } = fake({ data: [{ ended_at: "2026-11-06T08:00:00Z" }], error: null });
    expect(await tageSeitLetzterEinheit(client, jetzt)).toEqual({ ok: true, daten: 0 });
  });
  test("vor 15 Tagen → 15", async () => {
    const { client } = fake({ data: [{ ended_at: "2026-10-22T11:00:00Z" }], error: null });
    expect(await tageSeitLetzterEinheit(client, jetzt)).toEqual({ ok: true, daten: 15 });
  });
  test("nie → null", async () => {
    const { client } = fake({ data: [], error: null });
    expect(await tageSeitLetzterEinheit(client, jetzt)).toEqual({ ok: true, daten: null });
  });
});

describe("alsEinheiten", () => {
  const zeile = (z: Partial<Satzzeile>): Satzzeile => ({
    workout_id: "w1",
    set_no: 1,
    reps: 12,
    weight_kg: 20,
    technique: "sauber",
    pain: false,
    created_at: "2026-11-01T10:00:00Z",
    workouts: { regeneration: "gut", started_at: "2026-11-01T09:50:00Z" },
    ...z,
  });

  test("gruppiert nach Workout, älteste zuerst, häufigstes Gewicht", () => {
    const einheiten = alsEinheiten([
      zeile({ workout_id: "w2", set_no: 1, weight_kg: 22.5, created_at: "2026-11-03T10:00:00Z", workouts: { regeneration: null, started_at: "2026-11-03T09:00:00Z" } }),
      zeile({ workout_id: "w1", set_no: 1 }),
      zeile({ workout_id: "w1", set_no: 2, weight_kg: 20, reps: 11 }),
      zeile({ workout_id: "w1", set_no: 3, weight_kg: 17.5, reps: 10 }),
    ]);
    expect(einheiten).toEqual([
      { gewichtKg: 20, wiederholungenProSatz: [12, 11, 10], technik: "sauber", schmerz: false, regeneration: "gut" },
      { gewichtKg: 22.5, wiederholungenProSatz: [12], technik: "sauber", schmerz: false, regeneration: "unbekannt" },
    ]);
  });

  test("wackelige Technik und Schmerz schlagen auf die Einheit durch", () => {
    const [e] = alsEinheiten([zeile({}), zeile({ set_no: 2, technique: "wackelig", pain: true })]);
    expect(e.technik).toBe("wackelig");
    expect(e.schmerz).toBe(true);
  });

  test("Sätze innerhalb eines Workouts nach Satznummer", () => {
    const [e] = alsEinheiten([zeile({ set_no: 2, reps: 8 }), zeile({ set_no: 1, reps: 12 })]);
    expect(e.wiederholungenProSatz).toEqual([12, 8]);
  });

  test("Körpergewicht (leeres Gewicht) zählt als 0 kg", () => {
    expect(alsEinheiten([zeile({ weight_kg: null })])[0].gewichtKg).toBe(0);
  });
});
