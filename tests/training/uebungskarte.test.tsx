import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ProtokollPage from "../../app/(app)/training/protokoll/[workoutId]/page";
import { fuehreAbfrage, setzeZurueck } from "../../lib/demo/db";
import { demoServerClient } from "../../lib/demo/server";
import { ERKLAERUNGEN } from "../../lib/training/erklaerung";
import type { Satzzeile } from "../../lib/training/log";
import { baueKarte, empfehlungText, STANDARD_ZIEL } from "../../lib/training/uebungskarte";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("../../lib/consent/require-consent", () => ({ requireConsent: async () => undefined }));
vi.mock("../../lib/supabase/client", () => ({ createClient: () => demoServerClient() }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => demoServerClient() }));

const satz = (workout: string, tag: number, set_no: number, reps: number, weight_kg: number | null, mehr: Partial<Satzzeile> = {}): Satzzeile => ({
  workout_id: workout,
  set_no,
  reps,
  weight_kg,
  technique: "sauber",
  pain: false,
  created_at: `2026-11-0${tag}T10:0${set_no}:00Z`,
  workouts: { regeneration: null, started_at: `2026-11-0${tag}T10:00:00Z` },
  ...mehr,
});
const dreiEinheiten = (mehr: Partial<Satzzeile> = {}) => [
  ...[1, 2, 3].flatMap((tag) => [satz(`w${tag}`, tag, 1, 12, 20), satz(`w${tag}`, tag, 2, 12, 20)]),
  satz("w4", 4, 1, 12, 20, mehr),
  satz("w4", 4, 2, 12, 20),
];

describe("baueKarte", () => {
  test("ohne Sätze: kein Rückblick, keine Empfehlung", () => expect(baueKarte([], STANDARD_ZIEL, 2.5)).toEqual({ zuletzt: [], empfehlung: null }));

  test("zuletzt: die drei jüngsten Einheiten, neueste zuerst, mit Wiederholungen je Satz", () => {
    const { zuletzt } = baueKarte(dreiEinheiten(), STANDARD_ZIEL, 2.5);
    expect(zuletzt.map((r) => r.workoutId)).toEqual(["w4", "w3", "w2"]);
    expect(zuletzt[0]).toMatchObject({ gewichtKg: 20, wiederholungen: [12, 12] });
  });

  test("drei vergleichbare Einheiten am oberen Ziel, saubere Technik: Steigerung prüfen mit Vorschlagsgewicht", () => {
    const { empfehlung } = baueKarte(dreiEinheiten(), STANDARD_ZIEL, 2.5);
    expect(empfehlung).toMatchObject({ aktion: "steigerung_pruefen", zielgewichtKg: 22.5, grund: "ziel_erreicht" });
    expect(empfehlungText(empfehlung!)).toEqual({ titel: "Steigerung prüfen", vorschlag: "Du kannst 22,5 kg ausprobieren.", erklaerung: ERKLAERUNGEN.ziel_erreicht });
  });

  test("Schmerz in einer Einheit: halten mit dem Schmerz-Text", () => {
    const { empfehlung } = baueKarte(dreiEinheiten({ pain: true }), STANDARD_ZIEL, 2.5);
    expect(empfehlung).toMatchObject({ aktion: "halten", zielgewichtKg: 20, grund: "schmerz" });
    expect(empfehlungText(empfehlung!)).toMatchObject({ titel: "Gewicht halten", vorschlag: "Du kannst bei 20 kg bleiben.", erklaerung: ERKLAERUNGEN.schmerz });
  });

  test("die kleinste Gewichtsstufe aus dem Profil bestimmt den Vorschlag", () => {
    expect(baueKarte(dreiEinheiten(), STANDARD_ZIEL, 1.25).empfehlung?.zielgewichtKg).toBe(21.25);
  });
});

// Protokoll gegen den Demo-Speicher (lib/demo): derselbe Abfrageweg wie mit Supabase.
describe("Übungskarte im Protokoll", () => {
  const RUDERN = "demo-rudern-kurzhantel";
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "on");
    setzeZurueck();
    fuehreAbfrage("workouts", [{ m: "insert", a: [{ id: "heute", user_id: "u", started_at: "2026-11-09T10:00:00Z" }] }]);
    // Rudern soll die gewählte Übung sein: zuletzt benutzte Übungen stehen im Protokoll oben.
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });
  const frueher = (tage: number[], mehr: object = {}) => {
    for (const tag of tage) {
      fuehreAbfrage("workouts", [{ m: "insert", a: [{ id: `w${tag}`, user_id: "u", started_at: `2026-11-0${tag}T10:00:00Z`, ended_at: `2026-11-0${tag}T11:00:00Z` }] }]);
      for (const set_no of [1, 2]) {
        fuehreAbfrage("workout_sets", [
          { m: "insert", a: [{ workout_id: `w${tag}`, exercise_id: RUDERN, set_no, reps: 12, weight_kg: 20, created_at: `2026-11-0${tag}T10:0${set_no}:00Z`, ...mehr }] },
        ]);
      }
    }
  };
  const zeige = async () => {
    render(await ProtokollPage({ params: Promise.resolve({ workoutId: "heute" }) }));
    fireEvent.change(screen.getByLabelText("Übung"), { target: { value: RUDERN } });
    return within(screen.getByRole("region", { name: "Übungskarte" }));
  };

  test("ohne Verlauf: Einstiegstext, Name, Muskelgruppen und Technik", async () => {
    const karte = await zeige();
    expect(await karte.findByText("Noch keine Einheit – starte mit einem Gewicht, das sich gut anfühlt.")).toBeTruthy();
    expect(karte.getByRole("heading", { name: "Rudern mit Kurzhantel" })).toBeTruthy();
    expect(karte.getByText("Rücken, Bizeps")).toBeTruthy();
    expect(karte.queryByRole("button", { name: "Übernehmen" })).toBeNull();
  });

  test("drei Einheiten am Ziel: „Steigerung prüfen“ mit Erklärung; das Gewichtsfeld ändert sich erst mit „Übernehmen“", async () => {
    frueher([1, 2, 3]);
    const karte = await zeige();
    expect(await karte.findByRole("heading", { name: "Empfehlung heute: Steigerung prüfen" })).toBeTruthy();
    expect(karte.getByText("Du kannst 22,5 kg ausprobieren.")).toBeTruthy();
    expect(karte.getByText(ERKLAERUNGEN.ziel_erreicht)).toBeTruthy();
    expect(within(karte.getByRole("list", { name: "Zuletzt" })).getAllByRole("listitem")).toHaveLength(3);
    const gewicht = screen.getByLabelText("Gewicht (kg)") as HTMLInputElement;
    // Vorbelegt ist das letzte Gewicht (bisheriges Verhalten), nicht der Vorschlag.
    await vi.waitFor(() => expect(gewicht.value).toBe("20"));
    fireEvent.click(karte.getByRole("button", { name: "Übernehmen" }));
    expect(gewicht.value).toBe("22.5");
  });

  test("Schmerz in einer Einheit: „Gewicht halten“ mit dem Schmerz-Text", async () => {
    frueher([1, 2, 3], { pain: true });
    const karte = await zeige();
    expect(await karte.findByRole("heading", { name: "Empfehlung heute: Gewicht halten" })).toBeTruthy();
    expect(karte.getByText(ERKLAERUNGEN.schmerz)).toBeTruthy();
  });

  test("Sätze des laufenden Trainings zählen nicht als „zuletzt“", async () => {
    fuehreAbfrage("workout_sets", [{ m: "insert", a: [{ workout_id: "heute", exercise_id: RUDERN, set_no: 1, reps: 12, weight_kg: 20 }] }]);
    const karte = await zeige();
    expect(await karte.findByText("Noch keine Einheit – starte mit einem Gewicht, das sich gut anfühlt.")).toBeTruthy();
  });
});
