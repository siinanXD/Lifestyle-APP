import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import TrainingPage from "../../app/(app)/training/page";
import ProtokollPage from "../../app/(app)/training/protokoll/[workoutId]/page";
import { fuehreAbfrage, setzeZurueck } from "../../lib/demo/db";
import { demoServerClient } from "../../lib/demo/server";
import { setzeQueue } from "../../lib/offline/sync";
import { bewerteComeback } from "../../lib/training/comeback";
import { aenderungText, BEFINDEN, gemerktesComeback, GRUENDE, merkeComeback, TEXTE, vergissComeback } from "../../lib/training/comeback-ablauf";
import { ERKLAERUNGEN } from "../../lib/training/erklaerung";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("../../lib/consent/require-consent", () => ({ requireConsent: async () => undefined }));
vi.mock("../../lib/supabase/client", () => ({ createClient: () => demoServerClient() }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => demoServerClient() }));

const RUDERN = "demo-rudern-kurzhantel";
const vorTagen = (tage: number, plusMin = 0) => new Date(Date.now() - tage * 24 * 60 * 60 * 1000 + plusMin * 60 * 1000).toISOString();
const lege = (tabelle: string, zeile: object) => fuehreAbfrage(tabelle, [{ m: "insert", a: [zeile] }]);
const checkins = () => fuehreAbfrage("comeback_checkins", [{ m: "select", a: ["*"] }]).data as Record<string, unknown>[];
/** Letztes beendetes Training vor `tage` Tagen mit zwei Sätzen Rudern bei 20 kg. */
function letztesTraining(tage: number) {
  lege("workouts", { id: "alt", user_id: "u", started_at: vorTagen(tage, -60), ended_at: vorTagen(tage) });
  for (const set_no of [1, 2]) lege("workout_sets", { workout_id: "alt", exercise_id: RUDERN, set_no, reps: 12, weight_kg: 20, created_at: vorTagen(tage, -30 + set_no) });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "on");
  setzeZurueck();
  setzeQueue();
  vergissComeback();
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("Texte", () => {
  test("die Änderung nennt die Werte aus bewerteComeback", () => {
    expect(aenderungText(bewerteComeback(5))).toBe(TEXTE.normal);
    expect(aenderungText(bewerteComeback(20))).toBe("Wir starten etwas leichter: 10 % weniger Gewicht.");
    expect(aenderungText(bewerteComeback(30))).toBe("Wir starten etwas leichter: 20 % weniger Gewicht, ein Satz weniger.");
    expect(aenderungText(bewerteComeback(100))).toBe("Wir starten etwas leichter: 40 % weniger Gewicht, ein Satz weniger.");
  });

  test("keine Schuldzuweisung in den Texten", () => {
    const alle = [...Object.values(TEXTE), ...Object.values(GRUENDE), ...Object.values(BEFINDEN), ...[20, 30, 100].map((t) => aenderungText(bewerteComeback(t)))];
    for (const text of alle) expect(text).not.toMatch(/verpasst|versagt|faul|endlich|schon wieder/i);
  });

  test("gemerkt wird auf dem Gerät, bis das Training beendet ist", () => {
    expect(gemerktesComeback()).toBeNull();
    merkeComeback({ tage: 20, befinden: "schlecht" });
    expect(gemerktesComeback()?.stufe).toBe(2);
    vergissComeback();
    expect(gemerktesComeback()).toBeNull();
  });
});

describe("Karte auf /training", () => {
  const karte = () => screen.queryByRole("region", { name: "Wiedereinstieg" });

  test("unter 14 Tagen und ohne jedes Training keine Karte", async () => {
    render(await TrainingPage());
    expect(karte()).toBeNull();
    cleanup();
    letztesTraining(10);
    render(await TrainingPage());
    expect(karte()).toBeNull();
  });

  test("bei 20 Tagen Karte mit zwei freiwilligen Fragen; „Überspringen“ speichert nichts und zeigt trotzdem Stufe 1", async () => {
    letztesTraining(20);
    render(await TrainingPage());
    const k = within(karte()!);
    expect(k.getByRole("heading", { name: "Schön, dass du wieder da bist." })).toBeTruthy();
    expect(k.getByRole("group", { name: TEXTE.grund })).toBeTruthy();
    expect(k.getByRole("group", { name: TEXTE.befinden })).toBeTruthy();
    fireEvent.click(k.getByRole("button", { name: "Überspringen" }));
    expect(await k.findByText("Wir starten etwas leichter: 10 % weniger Gewicht.")).toBeTruthy();
    expect(checkins()).toEqual([]);
    expect(gemerktesComeback()?.stufe).toBe(1);
  });

  test("mit Einwilligung B wird die Antwort gespeichert (Grund, Befinden, Stufe, Tage); „schlecht“ führt eine Stufe höher", async () => {
    letztesTraining(20);
    render(await TrainingPage());
    const k = within(karte()!);
    fireEvent.click(k.getByRole("button", { name: "Krank oder verletzt" }));
    fireEvent.click(k.getByRole("button", { name: "Schlecht" }));
    fireEvent.click(k.getByRole("button", { name: "Weiter" }));
    expect(await k.findByText("Wir starten etwas leichter: 20 % weniger Gewicht, ein Satz weniger.")).toBeTruthy();
    expect(k.getByText(TEXTE.aerztlich)).toBeTruthy();
    expect(checkins()).toMatchObject([{ days_since_last: 20, reason: "krank_oder_verletzt", feeling: "schlecht", level: 2 }]);
    expect(gemerktesComeback()?.stufe).toBe(2);
  });

  test("ohne Einwilligung B wird nichts gespeichert, die Stufe gilt trotzdem", async () => {
    fuehreAbfrage("consents", [{ m: "delete", a: [] }, { m: "eq", a: ["kind", "B"] }]);
    letztesTraining(20);
    render(await TrainingPage());
    const k = within(karte()!);
    fireEvent.click(k.getByRole("button", { name: "Urlaub" }));
    fireEvent.click(k.getByRole("button", { name: "Weiter" }));
    expect(await k.findByText("Wir starten etwas leichter: 10 % weniger Gewicht.")).toBeTruthy();
    expect(k.queryByRole("alert")).toBeNull();
    expect(checkins()).toEqual([]);
  });
});

test("die Übungskarte zeigt nach der Rückkehr das reduzierte Gewicht mit Erklärung", async () => {
  letztesTraining(20);
  merkeComeback({ tage: 20, befinden: "schlecht" }); // Stufe 2: 20 % weniger → 16 kg, abgerundet auf die 2,5-kg-Stufe: 15 kg
  lege("workouts", { id: "heute", user_id: "u" });
  render(await ProtokollPage({ params: Promise.resolve({ workoutId: "heute" }) }));
  fireEvent.change(screen.getByLabelText("Übung"), { target: { value: RUDERN } });
  const k = within(screen.getByRole("region", { name: "Übungskarte" }));
  expect(await k.findByRole("heading", { name: "Empfehlung heute: Sanfter Einstieg" })).toBeTruthy();
  expect(k.getByText("Du kannst 15 kg ausprobieren.")).toBeTruthy();
  expect(k.getByText(ERKLAERUNGEN.comeback_stufe_2)).toBeTruthy();
});
