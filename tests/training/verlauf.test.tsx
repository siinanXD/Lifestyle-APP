import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import VerlaufDetailPage from "../../app/(app)/training/verlauf/[workoutId]/page";
import VerlaufPage from "../../app/(app)/training/verlauf/page";
import { fuehreAbfrage, setzeZurueck } from "../../lib/demo/db";
import { demoServerClient } from "../../lib/demo/server";
import { ladeVerlauf, mischeVerlauf, SEITENGROESSE } from "../../lib/training/verlauf";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("../../lib/consent/require-consent", () => ({ requireConsent: async () => undefined }));
vi.mock("../../lib/supabase/client", () => ({ createClient: () => demoServerClient() }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => demoServerClient() }));

const w = (id: string, started_at: string) => ({ id, started_at, ended_at: started_at });
const a = (id: string, started_at: string) => ({ id, started_at, activity: "Joggen", duration_min: 30, distance_km: 5 });

describe("mischeVerlauf", () => {
  test("leere Listen ergeben keinen Monat", () => expect(mischeVerlauf([], [])).toEqual([]));

  test("neueste zuerst, Workouts und Aktivitäten gemischt", () => {
    const [monat] = mischeVerlauf([w("w1", "2026-11-03T10:00:00Z"), w("w2", "2026-11-09T10:00:00Z")], [a("a1", "2026-11-05T10:00:00Z")]);
    expect(monat.eintraege.map((e) => e.id)).toEqual(["w2", "a1", "w1"]);
    expect(monat.eintraege.map((e) => e.art)).toEqual(["workout", "aktivitaet", "workout"]);
  });

  test("Gruppierung nach Monat in deutscher Zeit: 31.10. 23:30 UTC gehört schon zum November", () => {
    const monate = mischeVerlauf([w("okt", "2026-10-31T20:00:00Z"), w("nov", "2026-10-31T23:30:00Z")], [a("sep", "2026-09-15T08:00:00Z")]);
    expect(monate.map((m) => [m.monat, m.eintraege.map((e) => e.id)])).toEqual([
      ["November 2026", ["nov"]],
      ["Oktober 2026", ["okt"]],
      ["September 2026", ["sep"]],
    ]);
  });
});

// Seiten und Datenzugriff gegen den Demo-Speicher (lib/demo): derselbe Abfrageweg wie mit Supabase.
describe("Seiten", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "on");
    setzeZurueck();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });
  const lege = (tabelle: string, zeile: object) => fuehreAbfrage(tabelle, [{ m: "insert", a: [zeile] }]);
  const anzahl = (tabelle: string) => (fuehreAbfrage(tabelle, [{ m: "select", a: ["id"] }]).data as unknown[]).length;

  test("leerer Zustand ohne Schuldzuweisung", async () => {
    render(await VerlaufPage());
    expect(screen.getByText("Hier erscheinen deine Einheiten.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mehr laden" })).toBeNull();
  });

  test("Liste nach Monaten; Löschen ohne Bestätigung löscht nichts, mit Bestätigung wird gelöscht", async () => {
    lege("workouts", w("w1", "2026-11-09T10:00:00Z"));
    lege("activity_logs", a("a1", "2026-10-05T10:00:00Z"));
    render(await VerlaufPage());
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["November 2026", "Oktober 2026"]);
    const november = within(screen.getByRole("region", { name: "November 2026" }));
    expect(november.getByRole("link", { name: "Training" }).getAttribute("href")).toBe("/training/verlauf/w1");
    expect(within(screen.getByRole("region", { name: "Oktober 2026" })).getByText("Joggen · 30 Min · 5 km")).toBeTruthy();

    fireEvent.click(november.getByRole("button", { name: /löschen$/ }));
    expect(november.getByText("Wirklich löschen?")).toBeTruthy();
    expect(anzahl("workouts")).toBe(1);
    fireEvent.click(november.getByRole("button", { name: "Abbrechen" }));
    expect(anzahl("workouts")).toBe(1);
    fireEvent.click(november.getByRole("button", { name: /löschen$/ }));
    fireEvent.click(november.getByRole("button", { name: "Ja, löschen" }));
    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "November 2026" })).toBeNull());
    expect(anzahl("workouts")).toBe(0);
    expect(anzahl("activity_logs")).toBe(1);
  });

  test("„Mehr laden“ holt die nächste Seite ohne Lücke und ohne Dopplung", async () => {
    for (let i = 0; i < 15; i++) {
      lege("workouts", w(`w${i}`, new Date(Date.UTC(2026, 10, 1, 8, i * 2)).toISOString()));
      lege("activity_logs", a(`a${i}`, new Date(Date.UTC(2026, 10, 1, 8, i * 2 + 1)).toISOString()));
    }
    const erste = await ladeVerlauf(demoServerClient() as never);
    if (!erste.ok) throw new Error(erste.fehler);
    expect(erste.daten.eintraege).toHaveLength(SEITENGROESSE);
    render(await VerlaufPage());
    expect(screen.getAllByRole("listitem")).toHaveLength(20);
    fireEvent.click(screen.getByRole("button", { name: "Mehr laden" }));
    await vi.waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(30));
    expect(screen.queryByRole("button", { name: "Mehr laden" })).toBeNull();
  });

  test("Detailseite zeigt Sätze je Übung, Technik- und Schmerzmarkierung, Gefühl und Notiz", async () => {
    lege("workouts", { ...w("w1", "2026-11-09T10:00:00Z"), regeneration: "gut", note: "Lief rund" });
    const satz = { workout_id: "w1", exercise_id: "demo-rudern-kurzhantel", reps: 12, weight_kg: 10 };
    lege("workout_sets", { ...satz, set_no: 1 });
    lege("workout_sets", { ...satz, set_no: 2, reps: 10, technique: "wackelig", pain: true });
    lege("workout_sets", { workout_id: "w1", exercise_id: "demo-plank", set_no: 1, reps: 30, weight_kg: null });
    render(await VerlaufDetailPage({ params: Promise.resolve({ workoutId: "w1" }) }));
    const rudern = within(screen.getByRole("region", { name: "Rudern mit Kurzhantel" }));
    expect(rudern.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["12 × 10 kg", "10 × 10 kg · wackelig · Schmerz"]);
    expect(within(screen.getByRole("region", { name: "Unterarmstütz (Plank)" })).getByText("30 × Körpergewicht")).toBeTruthy();
    expect(screen.getByText("Gefühl danach: gut")).toBeTruthy();
    expect(screen.getByText("Lief rund")).toBeTruthy();
  });

  test("unbekannte oder fremde ID liefert 404", async () => {
    await expect(VerlaufDetailPage({ params: Promise.resolve({ workoutId: "fremd" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("Detail: Löschen fragt zuerst und führt danach zum Verlauf", async () => {
    lege("workouts", w("w1", "2026-11-09T10:00:00Z"));
    render(await VerlaufDetailPage({ params: Promise.resolve({ workoutId: "w1" }) }));
    fireEvent.click(screen.getByRole("button", { name: "Training löschen" }));
    expect(anzahl("workouts")).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Ja, löschen" }));
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith("/training/verlauf"));
    expect(anzahl("workouts")).toBe(0);
  });
});
