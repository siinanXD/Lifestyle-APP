import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import TrainingPage from "../../app/(app)/training/page";
import PlanPage from "../../app/(app)/training/plan/page";
import ProtokollPage from "../../app/(app)/training/protokoll/[workoutId]/page";
import { fuehreAbfrage, setzeZurueck } from "../../lib/demo/db";
import { demoServerClient } from "../../lib/demo/server";
import { erstellePlan } from "../../lib/training/plan";
import { ladePlanEingabe, speicherePlan } from "../../lib/training/plan-eingabe";

// Seiten gegen den Demo-Speicher (lib/demo): derselbe Abfrageweg wie mit Supabase, ohne Datenbank und ohne gemockte Datenschicht.
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("../../lib/consent/require-consent", () => ({ requireConsent: async () => undefined }));
vi.mock("../../lib/supabase/client", () => ({ createClient: () => demoServerClient() }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => demoServerClient() }));

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "on");
  setzeZurueck();
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

async function mitPlan() {
  const client = demoServerClient() as never;
  const eingabe = await ladePlanEingabe(client);
  if (!eingabe.ok) throw new Error(eingabe.fehler);
  const r = await speicherePlan(client, erstellePlan(eingabe.daten.angaben, eingabe.daten.katalog));
  if (!r.ok) throw new Error(r.fehler);
  return r.daten.id;
}
const zeilen = (tabelle: string) => fuehreAbfrage(tabelle, [{ m: "select", a: ["*"] }]).data as Record<string, unknown>[];

test("ohne Plan: Planseite und Training bieten „Plan erstellen“ an, freies Training bleibt möglich", async () => {
  render(await PlanPage());
  expect(screen.getByRole("link", { name: "Plan erstellen" }).getAttribute("href")).toBe("/training/plan/neu");
  cleanup();
  render(await TrainingPage());
  expect(screen.getByRole("link", { name: "Plan erstellen" }).getAttribute("href")).toBe("/training/plan/neu");
  expect(screen.getByRole("button", { name: "Freies Training starten" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Heute dran" })).toBeNull();
});

test("Planseite zeigt Tage mit Übungen, Link zur Übung und zum neuen Plan", async () => {
  await mitPlan();
  render(await PlanPage());
  expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"))).toEqual(["Tag 1", "Tag 2", "Tag 3"]);
  const tag1 = within(screen.getByRole("region", { name: "Tag 1" }));
  expect(tag1.getByRole("link", { name: "Liegestütz" }).getAttribute("href")).toBe("/training/uebungen/liegestuetz");
  expect(tag1.getAllByText(/2 × 10–15/, { selector: "span" })).toHaveLength(4);
  expect(screen.getByRole("link", { name: "Neuen Plan erstellen" }).getAttribute("href")).toBe("/training/plan/neu");
});

test("Übung austauschen speichert, zeigt die neue Übung und setzt source auf manuell", async () => {
  const planId = await mitPlan();
  render(await PlanPage());
  fireEvent.click(screen.getByRole("button", { name: "Liegestütz an Tag 1 ändern" }));
  fireEvent.change(screen.getByLabelText("Übung"), { target: { value: "demo-joggen" } });
  fireEvent.change(screen.getByLabelText("Sätze"), { target: { value: "4" } });
  fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
  const tag1 = within(screen.getByRole("region", { name: "Tag 1" }));
  expect(await tag1.findByText(/Joggen: 4 × 10–15/)).toBeTruthy();
  expect(screen.getByText("Von dir angepasst")).toBeTruthy();
  expect(zeilen("training_plans").find((p) => p.id === planId)?.source).toBe("manuell");
  expect(zeilen("plan_items").some((i) => i.exercise_id === "demo-joggen" && i.sets === 4)).toBe(true);
});

test("ungültige Vorgaben: Meldung, nichts gespeichert", async () => {
  const planId = await mitPlan();
  render(await PlanPage());
  fireEvent.click(screen.getByRole("button", { name: "Liegestütz an Tag 1 ändern" }));
  fireEvent.change(screen.getByLabelText("Sätze"), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
  expect((await screen.findByRole("alert")).textContent).toContain("1 bis 10 Sätze");
  expect(zeilen("training_plans").find((p) => p.id === planId)?.source).toBe("regeln");
});

test("Plan löschen fragt zuerst; Abbrechen lässt den Plan stehen, „Ja, löschen“ entfernt ihn", async () => {
  const planId = await mitPlan();
  render(await PlanPage());
  fireEvent.click(screen.getByRole("button", { name: "Plan löschen" }));
  expect(screen.getByRole("heading", { name: "Plan wirklich löschen?" })).toBeTruthy();
  expect(zeilen("training_plans").some((p) => p.id === planId)).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
  expect(screen.queryByRole("heading", { name: "Plan wirklich löschen?" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Plan löschen" }));
  fireEvent.click(screen.getByRole("button", { name: "Ja, löschen" }));
  await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith("/training"));
  expect(zeilen("training_plans").some((p) => p.id === planId)).toBe(false);
});

test("„Training starten“ erzeugt ein Workout mit Planbezug und öffnet das Protokoll mit den Plan-Übungen", async () => {
  const planId = await mitPlan();
  render(await TrainingPage());
  const heute = within(screen.getByRole("region", { name: "Heute dran" }));
  expect(heute.getByRole("heading", { name: "Tag 1" })).toBeTruthy();
  fireEvent.click(heute.getByRole("button", { name: "Training starten" }));
  await vi.waitFor(() => expect(router.push).toHaveBeenCalled());
  const workout = zeilen("workouts")[0];
  expect(workout).toMatchObject({ plan_id: planId, plan_day_no: 1 });
  expect(router.push).toHaveBeenCalledWith(`/training/protokoll/${workout.id}`);

  cleanup();
  render(await ProtokollPage({ params: Promise.resolve({ workoutId: String(workout.id) }) }));
  const geplant = within(screen.getByRole("region", { name: "Geplant" }));
  expect(geplant.getAllByRole("listitem")).toHaveLength(4);
  expect(geplant.getByText("Liegestütz: 2 × 10–15")).toBeTruthy();
  // Erste geplante Übung ist gewählt, Wiederholungen mit dem unteren Ziel vorbelegt.
  const erste = zeilen("plan_items").find((i) => i.plan_id === planId && i.day_no === 1 && i.position === 1)!;
  expect((screen.getByLabelText("Übung") as HTMLSelectElement).value).toBe(erste.exercise_id);
  expect((screen.getByLabelText("Wiederholungen") as HTMLInputElement).value).toBe("10");

  // Nach dem Training von Tag 1 ist Tag 2 dran.
  cleanup();
  render(await TrainingPage());
  expect(within(screen.getByRole("region", { name: "Heute dran" })).getByRole("heading", { name: "Tag 2" })).toBeTruthy();
});

test("freies Training hat keinen Abschnitt „Geplant“", async () => {
  fuehreAbfrage("workouts", [{ m: "insert", a: [{ id: "frei", user_id: "u" }] }]);
  render(await ProtokollPage({ params: Promise.resolve({ workoutId: "frei" }) }));
  expect(screen.queryByRole("region", { name: "Geplant" })).toBeNull();
});
