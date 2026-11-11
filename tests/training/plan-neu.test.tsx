import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import PlanNeuPage from "../../app/(app)/training/plan/neu/page";
import { PLAN_HINWEISE } from "../../lib/training/plan-texte";

const eingabe = vi.hoisted(() => ({ ladePlanEingabe: vi.fn(), speicherePlan: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("../../lib/training/plan-eingabe", async (original) => ({ ...(await original<object>()), ...eingabe }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../../lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => ({}) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const u = (slug: string, name: string, muscle: string) => ({
  id: slug, slug, name, category: "bodyweight" as const, muscle_groups: [muscle], equipment: [], joints: [], variant_of: null,
});
const katalog = [u("kniebeuge", "Kniebeuge", "beine"), u("liegestuetz", "Liegestütz", "brust"), u("rudern", "Rudern am Tisch", "ruecken")];
const lade = (angaben: object, ohneBeschwerden = false) =>
  eingabe.ladePlanEingabe.mockResolvedValue({ ok: true, daten: { angaben, katalog, ohneBeschwerden } });

test("leeres Profil: „Allgemeiner Vorschlag“ ist sichtbar, Tage zeigen Übungen mit Sätzen × Wiederholungen", async () => {
  lade({});
  render(await PlanNeuPage());
  expect(screen.getByText("Allgemeiner Vorschlag")).toBeTruthy();
  expect(screen.getAllByRole("region")).toHaveLength(3);
  expect(within(screen.getByRole("region", { name: "Tag 1" })).getByText("Kniebeuge: 2 × 10–15")).toBeTruthy();
});

test("mit Angaben fehlt die Kennzeichnung „Allgemeiner Vorschlag“", async () => {
  lade({ tageProWoche: 2, erfahrung: "regelmaessig" });
  render(await PlanNeuPage());
  expect(screen.queryByText("Allgemeiner Vorschlag")).toBeNull();
  expect(screen.getAllByRole("region")).toHaveLength(2);
  expect(screen.getAllByText("Kniebeuge: 3 × 8–12")).toHaveLength(2);
});

test("ohne Einwilligung B erscheint der Hinweis auf den allgemeinen Plan", async () => {
  lade({ tageProWoche: 2 }, true);
  render(await PlanNeuPage());
  expect(screen.getByText("Allgemeiner Plan, ohne Rücksicht auf Beschwerden.")).toBeTruthy();
});

test("Hinweise der Engine stehen im Klartext da", async () => {
  lade({ comebackStufe: 2 });
  render(await PlanNeuPage());
  expect(screen.getByText(PLAN_HINWEISE.sanfter_einstieg)).toBeTruthy();
});

test("Übernehmen speichert den gezeigten Plan und führt zum Training", async () => {
  lade({});
  eingabe.speicherePlan.mockResolvedValue({ ok: true, daten: { id: "neu" } });
  render(await PlanNeuPage());
  fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
  await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith("/training"));
  const plan = eingabe.speicherePlan.mock.calls[0][1];
  expect(plan.allgemein).toBe(true);
  expect(plan.tage).toHaveLength(3);
});

test("Fehler beim Speichern: Meldung, keine Weiterleitung, erneuter Versuch möglich", async () => {
  lade({});
  eingabe.speicherePlan.mockResolvedValue({ ok: false, fehler: "23503" });
  render(await PlanNeuPage());
  fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Dein bisheriger Plan ist unverändert");
  expect(router.push).not.toHaveBeenCalled();
  expect((screen.getByRole("button", { name: "Übernehmen" }) as HTMLButtonElement).disabled).toBe(false);
});

test("Neu berechnen lädt die Seite neu; ohne passende Übung ist Übernehmen gesperrt", async () => {
  eingabe.ladePlanEingabe.mockResolvedValue({ ok: true, daten: { angaben: {}, katalog: [], ohneBeschwerden: false } });
  render(await PlanNeuPage());
  fireEvent.click(screen.getByRole("button", { name: "Neu berechnen" }));
  expect(router.refresh).toHaveBeenCalled();
  expect((screen.getByRole("button", { name: "Übernehmen" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("link", { name: "Angaben ändern" }).getAttribute("href")).toBe("/onboarding");
});

test("Lesefehler wird nicht als leerer Plan gezeigt", async () => {
  eingabe.ladePlanEingabe.mockResolvedValue({ ok: false, fehler: "netz" });
  await expect(PlanNeuPage()).rejects.toThrow("Plan-Angaben konnten nicht geladen werden");
});
