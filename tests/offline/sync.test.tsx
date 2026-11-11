import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Protokoll } from "../../app/(app)/training/protokoll/[workoutId]/protokoll";
import { SyncProvider } from "../../app/sync-provider";
import { fuehreAbfrage, setzeZurueck } from "../../lib/demo/db";
import { demoServerClient } from "../../lib/demo/server";
import { memorySpeicher } from "../../lib/offline/memory";
import { neuerEintrag } from "../../lib/offline/queue";
import { sender } from "../../lib/offline/senden";
import { queue, reiheEin, setzeQueue, synchronisiere } from "../../lib/offline/sync";

// Netz und Sitzung lassen sich je Test umschalten; dahinter liegt der Demo-Speicher (lib/demo), derselbe Abfrageweg wie mit Supabase.
const netz = vi.hoisted(() => ({ offline: false, angemeldet: true, anfragen: 0 }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("../../lib/supabase/client", () => ({
  createClient: () => {
    const abgelehnt = (): object =>
      new Proxy({}, {
        get: (_, prop) =>
          prop === "then" ? (_ok: unknown, fehler: (e: unknown) => unknown) => Promise.reject(new TypeError("Failed to fetch")).catch(fehler) : () => abgelehnt(),
      });
    const echt = demoServerClient();
    return {
      auth: { getUser: async () => ({ data: { user: netz.angemeldet ? { id: "u1" } : null } }) },
      from: (tabelle: string) => {
        netz.anfragen++;
        // Wie beim echten Client: Die Kette lässt sich offline bauen, erst das Absenden scheitert.
        if (netz.offline) return abgelehnt();
        return echt.from(tabelle);
      },
    };
  },
}));

const RUDERN = "demo-rudern-kurzhantel";
const saetze = () => fuehreAbfrage("workout_sets", [{ m: "select", a: ["*"] }]).data as Record<string, unknown>[];
const satz = (satzNr = 1, wdh = 12) => ({ workoutId: "w1", exerciseId: RUDERN, satzNr, wdh, gewichtKg: 20, technik: "sauber", schmerz: false });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "on");
  setzeZurueck();
  setzeQueue(memorySpeicher());
  Object.assign(netz, { offline: false, angemeldet: true, anfragen: 0 });
  fuehreAbfrage("workouts", [{ m: "insert", a: [{ id: "w1", user_id: "u1" }] }]);
});
afterEach(async () => {
  cleanup();
  await synchronisiere();
  vi.unstubAllEnvs();
});

describe("Protokoll über die Warteschlange", () => {
  const zeige = () =>
    render(
      <>
        <SyncProvider />
        <Protokoll workoutId="w1" uebungen={[{ id: RUDERN, name: "Rudern mit Kurzhantel" }]} saetze={[]} />
      </>,
    );
  const speichere = (wdh: string) => {
    fireEvent.change(screen.getByLabelText("Wiederholungen"), { target: { value: wdh } });
    fireEvent.click(screen.getByRole("button", { name: "Satz speichern" }));
  };

  test("online: Der Satz erscheint sofort und steht danach genau einmal in der Datenbank", async () => {
    zeige();
    speichere("12");
    expect(await screen.findByText(/^Satz 1: 12 Wdh/)).toBeTruthy();
    await vi.waitFor(() => expect(saetze()).toHaveLength(1));
    expect(saetze()[0]).toMatchObject({ workout_id: "w1", exercise_id: RUDERN, set_no: 1, reps: 12 });
    await vi.waitFor(async () => expect(await queue().alle()).toEqual([]));
  });

  test("offline bleibt der Satz in Queue und Anzeige; nach „online“ wird er genau einmal gesendet", async () => {
    netz.offline = true;
    zeige();
    speichere("12");
    expect(await screen.findByText(/^Satz 1: 12 Wdh/)).toBeTruthy();
    expect((await screen.findByRole("status")).textContent).toContain("1 Eintrag wartet auf Verbindung");
    expect(saetze()).toEqual([]);
    expect(await queue().alle()).toMatchObject([{ art: "satz", versuche: 1 }]);

    netz.offline = false;
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await vi.waitFor(() => expect(saetze()).toHaveLength(1));
    await vi.waitFor(() => expect(screen.queryByRole("status")).toBeNull());
    expect(await queue().alle()).toEqual([]);
    // Ein weiterer Durchgang sendet nichts mehr.
    const vorher = netz.anfragen;
    await synchronisiere();
    expect(netz.anfragen).toBe(vorher);
    expect(saetze()).toHaveLength(1);
  });

  test("drei Sätze offline erfasst kommen nach der Rückkehr in der richtigen Reihenfolge an; Löschen offline wirkt danach", async () => {
    netz.offline = true;
    zeige();
    for (const wdh of ["12", "11", "10"]) {
      speichere(wdh);
      await screen.findByText(new RegExp(`: ${wdh} Wdh`));
    }
    fireEvent.click(screen.getByRole("button", { name: "Satz 2 Rudern mit Kurzhantel löschen" }));
    await vi.waitFor(() => expect(screen.queryByText(/^Satz 2:/)).toBeNull());
    netz.offline = false;
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    await vi.waitFor(async () => expect(await queue().alle()).toEqual([]));
    expect(saetze().map((s) => [s.set_no, s.reps])).toEqual([[1, 12], [3, 10]]);
  });
});

describe("Abgleich", () => {
  test("kein Synchronisieren ohne Sitzung: nichts geht hinaus, der Eintrag bleibt", async () => {
    netz.angemeldet = false;
    await reiheEin("satz", satz());
    expect(await synchronisiere()).toBeNull();
    expect(netz.anfragen).toBe(0);
    expect(await queue().alle()).toHaveLength(1);
    netz.angemeldet = true;
    expect(await synchronisiere()).toMatchObject({ gesendet: 1, offen: 0 });
    expect(saetze()).toHaveLength(1);
  });

  test("leere Warteschlange fragt weder Sitzung noch Server an", async () => {
    expect(await synchronisiere()).toEqual({ gesendet: 0, offen: 0, fehlgeschlagen: 0 });
    expect(netz.anfragen).toBe(0);
  });
});

describe("Sender (Idempotenz)", () => {
  // Zeichnet die Kette auf, wie sie an Supabase ginge.
  function fake(antwort: { data?: unknown; error?: unknown } = { data: null, error: null }) {
    const aufrufe: [string, string, unknown[]][] = [];
    const kette = (tabelle: string): object =>
      new Proxy({}, {
        get(_, prop) {
          if (prop === "then") return (ok: (v: unknown) => unknown) => Promise.resolve(antwort).then(ok);
          return (...a: unknown[]) => {
            aufrufe.push([tabelle, String(prop), a]);
            return kette(tabelle);
          };
        },
      });
    return { client: { auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) }, from: kette } as never, aufrufe };
  }

  test("Abbruch nach dem Senden, vor dem Entfernen: erneutes Senden erzeugt keine doppelte Zeile", async () => {
    const eintrag = neuerEintrag("satz", satz());
    const sende = sender(demoServerClient() as never);
    expect(await sende(eintrag)).toEqual({ ok: true });
    expect(await sende(eintrag)).toEqual({ ok: true }); // Neustart: derselbe Eintrag geht noch einmal hinaus
    expect(saetze()).toHaveLength(1);
  });

  test("Sätze gehen per Upsert auf den Konfliktschlüssel, Workouts und Aktivitäten auf die id", async () => {
    const { client, aufrufe } = fake();
    const sende = sender(client);
    await sende(neuerEintrag("satz", satz()));
    await sende(neuerEintrag("workout_start", { id: "w9", planId: "p1", tagNr: 2 }));
    await sende(neuerEintrag("aktivitaet", { id: "a9", category: "cardio", activity: "Joggen", duration_min: 30, distance_km: null, effort: null, note: null }));
    const upserts = aufrufe.filter(([, m]) => m === "upsert");
    expect(upserts.map(([t, , a]) => [t, a[1]])).toEqual([
      ["workout_sets", { onConflict: "workout_id,set_no,exercise_id" }],
      ["workouts", { onConflict: "id", ignoreDuplicates: true }],
      ["activity_logs", { onConflict: "id" }],
    ]);
    expect(upserts[1][2][0]).toEqual({ id: "w9", user_id: "u1", plan_id: "p1", plan_day_no: 2 });
    expect(upserts[2][2][0]).toMatchObject({ id: "a9", user_id: "u1", activity: "Joggen" });
  });

  test("der zuletzt geschriebene Satz mit gleichem Schlüssel überschreibt (Gerät gewinnt)", async () => {
    const sende = sender(demoServerClient() as never);
    await sende(neuerEintrag("satz", satz(1, 12)));
    await sende(neuerEintrag("satz", satz(1, 8)));
    expect(saetze()).toMatchObject([{ set_no: 1, reps: 8 }]);
  });

  test("Löschen eines nicht vorhandenen Satzes ist kein Fehler", async () => {
    const sende = sender(demoServerClient() as never);
    expect(await sende(neuerEintrag("satz_loeschen", { workoutId: "w1", exerciseId: RUDERN, satzNr: 5 }))).toEqual({ ok: true });
  });

  test("Satz für ein inzwischen gelöschtes Workout wird verworfen statt ewig wiederholt", async () => {
    const { client } = fake({ data: null, error: { code: "23503" } });
    expect(await sender(client)(neuerEintrag("satz", satz()))).toEqual({ ok: true });
  });

  test("ein Netzfehler bleibt ein Fehler und wird später wiederholt", async () => {
    const { client } = fake({ data: null, error: { code: "PGRST000" } });
    expect(await sender(client)(neuerEintrag("satz", satz()))).toEqual({ ok: false, fehler: "PGRST000" });
  });

  test("Workout beenden und Aktivität über die Warteschlange landen in der Datenbank", async () => {
    await reiheEin("workout_ende", { id: "w1", regeneration: "gut" });
    await reiheEin("aktivitaet", { id: "a1", category: "cardio", activity: "Joggen", duration_min: 30, distance_km: 5, effort: null, note: null });
    await synchronisiere();
    expect((fuehreAbfrage("workouts", [{ m: "select", a: ["ended_at, regeneration"] }]).data as { ended_at: string | null; regeneration: string }[])[0]).toMatchObject({ regeneration: "gut", ended_at: expect.any(String) });
    expect(fuehreAbfrage("activity_logs", [{ m: "select", a: ["id, activity"] }]).data).toEqual([{ id: "a1", activity: "Joggen" }]);
  });
});
