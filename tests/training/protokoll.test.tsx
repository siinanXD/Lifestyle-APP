import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Protokoll } from "../../app/(app)/training/protokoll/[workoutId]/protokoll";
import ProtokollPage from "../../app/(app)/training/protokoll/[workoutId]/page";
import TrainingPage from "../../app/(app)/training/page";

const log = vi.hoisted(() => ({
  speichereSatz: vi.fn(),
  loescheSatz: vi.fn(),
  beendeWorkout: vi.fn(),
  letzteSaetze: vi.fn(),
  starteWorkout: vi.fn(),
  letzteWorkouts: vi.fn(),
  saetzeDesWorkouts: vi.fn(),
}));
const serverClient = vi.hoisted(() => vi.fn(async () => ({})));
const requireConsent = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("../../lib/training/log", () => log);
vi.mock("../../lib/consent/require-consent", () => ({ requireConsent }));
vi.mock("../../lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("../../lib/supabase/server", () => ({ createClient: serverClient }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const uebungen = [
  { id: "ex-rudern", name: "Rudern mit Kurzhantel" },
  { id: "ex-liegestuetz", name: "Liegestütz" },
];
const zeige = (saetze = []) => render(<Protokoll workoutId="w1" uebungen={uebungen} saetze={saetze} />);
const tippe = (label: string, wert: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: wert } });
const speichern = () => fireEvent.click(screen.getByRole("button", { name: "Satz speichern" }));

test("Training: ohne Einwilligung B wird umgeleitet und nichts geladen oder gespeichert", async () => {
  requireConsent.mockRejectedValue(new Error("NEXT_REDIRECT"));
  await expect(TrainingPage()).rejects.toThrow("NEXT_REDIRECT");
  expect(requireConsent).toHaveBeenCalledWith("B", "/training");
  expect(log.letzteWorkouts).not.toHaveBeenCalled();
  expect(log.starteWorkout).not.toHaveBeenCalled();
});

test("Protokoll: ohne Einwilligung B wird umgeleitet, nichts gelesen oder gespeichert", async () => {
  requireConsent.mockRejectedValue(new Error("NEXT_REDIRECT"));
  await expect(ProtokollPage({ params: Promise.resolve({ workoutId: "w1" }) })).rejects.toThrow("NEXT_REDIRECT");
  expect(requireConsent).toHaveBeenCalledWith("B", "/training/protokoll/w1");
  expect(serverClient).not.toHaveBeenCalled();
  expect(log.saetzeDesWorkouts).not.toHaveBeenCalled();
  expect(log.speichereSatz).not.toHaveBeenCalled();
});

test("Training: mit B zeigt Start-Knopf und die letzten Trainings", async () => {
  requireConsent.mockResolvedValue(undefined);
  log.letzteWorkouts.mockResolvedValue({ ok: true, daten: [{ id: "w7", started_at: "2026-11-06T10:00:00Z", ended_at: null, regeneration: null }] });
  render(await TrainingPage());
  expect(screen.getByRole("button", { name: "Freies Training starten" })).toBeTruthy();
  expect(screen.getByRole("link", { name: /06\.11\.2026/ }).getAttribute("href")).toBe("/training/protokoll/w7");
  expect(log.letzteWorkouts).toHaveBeenCalledWith(expect.anything(), 5);
});

test("Satz speichern ruft speichereSatz mit den Werten und zeigt ihn in der Liste", async () => {
  log.letzteSaetze.mockResolvedValue({ ok: true, daten: [] });
  log.speichereSatz.mockResolvedValue({ ok: true, daten: null });
  zeige();
  tippe("Wiederholungen", "12");
  tippe("Gewicht (kg)", "20");
  speichern();
  expect(await screen.findByText("Satz 1: 12 Wdh · 20 kg")).toBeTruthy();
  expect(log.speichereSatz).toHaveBeenCalledWith(expect.anything(), {
    workoutId: "w1",
    exerciseId: "ex-rudern",
    satzNr: 1,
    wdh: 12,
    gewichtKg: 20,
    technik: "sauber",
    schmerz: false,
  });
  speichern();
  expect(await screen.findByText("Satz 2: 12 Wdh · 20 kg")).toBeTruthy();
  expect(log.speichereSatz).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ satzNr: 2 }));
});

test("leeres Gewicht wird als Körpergewicht gespeichert; Schalter für Technik und Schmerz", async () => {
  log.letzteSaetze.mockResolvedValue({ ok: true, daten: [] });
  log.speichereSatz.mockResolvedValue({ ok: true, daten: null });
  zeige();
  tippe("Wiederholungen", "8");
  fireEvent.click(screen.getByRole("switch", { name: "Technik wackelig" }));
  fireEvent.click(screen.getByRole("switch", { name: "Schmerz" }));
  speichern();
  expect(await screen.findByText("Satz 1: 8 Wdh · Körpergewicht · wackelig · Schmerz")).toBeTruthy();
  expect(log.speichereSatz).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ gewichtKg: null, technik: "wackelig", schmerz: true }),
  );
});

test("negative oder fehlende Werte werden abgelehnt, nichts gespeichert", () => {
  log.letzteSaetze.mockResolvedValue({ ok: true, daten: [] });
  zeige();
  speichern();
  tippe("Wiederholungen", "-1");
  speichern();
  tippe("Wiederholungen", "10");
  tippe("Gewicht (kg)", "-5");
  speichern();
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  expect(log.speichereSatz).not.toHaveBeenCalled();
});

test("Speicherfehler: Satz erscheint nicht, ruhige Meldung", async () => {
  log.letzteSaetze.mockResolvedValue({ ok: true, daten: [] });
  log.speichereSatz.mockResolvedValue({ ok: false, fehler: "netz" });
  zeige();
  tippe("Wiederholungen", "12");
  speichern();
  expect((await screen.findByRole("alert")).textContent).toMatch(/nicht gespeichert/);
  expect(screen.queryByText(/^Satz 1:/)).toBeNull();
});

test("Vorbelegung mit dem letzten Gewicht der Übung", async () => {
  log.letzteSaetze.mockResolvedValue({ ok: true, daten: [{ weight_kg: 22.5 }] });
  zeige();
  await vi.waitFor(() => expect((screen.getByLabelText("Gewicht (kg)") as HTMLInputElement).value).toBe("22.5"));
  expect(log.letzteSaetze).toHaveBeenCalledWith(expect.anything(), "ex-rudern", 1);
});

test("gespeicherte Sätze vom Server werden angezeigt und lassen sich löschen", async () => {
  log.letzteSaetze.mockResolvedValue({ ok: true, daten: [] });
  log.loescheSatz.mockResolvedValue({ ok: true, daten: null });
  zeige([
    { exercise_id: "ex-rudern", exercises: { name: "Rudern mit Kurzhantel" }, set_no: 1, reps: 12, weight_kg: 20, technique: "sauber", pain: false },
  ] as never);
  expect(screen.getByText("Satz 1: 12 Wdh · 20 kg")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Satz 1 Rudern mit Kurzhantel löschen" }));
  await vi.waitFor(() => expect(screen.queryByText("Satz 1: 12 Wdh · 20 kg")).toBeNull());
  expect(log.loescheSatz).toHaveBeenCalledWith(expect.anything(), { workoutId: "w1", exerciseId: "ex-rudern", satzNr: 1 });
});

test("Beenden mit Regeneration gut setzt sie; Überspringen schreibt keine", async () => {
  log.letzteSaetze.mockResolvedValue({ ok: true, daten: [] });
  log.beendeWorkout.mockResolvedValue({ ok: true, daten: null });
  zeige();
  fireEvent.click(screen.getByRole("button", { name: "Training beenden" }));
  fireEvent.click(screen.getByRole("button", { name: "gut" }));
  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/training"));
  expect(log.beendeWorkout).toHaveBeenCalledWith(expect.anything(), "w1", { regeneration: "gut" });

  cleanup();
  zeige();
  fireEvent.click(screen.getByRole("button", { name: "Training beenden" }));
  fireEvent.click(screen.getByRole("button", { name: "Überspringen" }));
  await vi.waitFor(() => expect(log.beendeWorkout).toHaveBeenLastCalledWith(expect.anything(), "w1", {}));
});

test("Übungswechsel ohne frühere Sätze leert das Gewicht: Satz wird als Körpergewicht gespeichert", async () => {
  log.letzteSaetze.mockImplementation(async (_c: unknown, uebung: string) =>
    uebung === "ex-rudern" ? { ok: true, daten: [{ weight_kg: 20 }] } : { ok: true, daten: [] },
  );
  log.speichereSatz.mockResolvedValue({ ok: true, daten: null });
  zeige();
  const gewicht = screen.getByLabelText("Gewicht (kg)") as HTMLInputElement;
  await vi.waitFor(() => expect(gewicht.value).toBe("20"));
  fireEvent.change(screen.getByLabelText("Übung"), { target: { value: "ex-liegestuetz" } });
  await vi.waitFor(() => expect(log.letzteSaetze).toHaveBeenLastCalledWith(expect.anything(), "ex-liegestuetz", 1));
  await vi.waitFor(() => expect(gewicht.value).toBe(""));
  tippe("Wiederholungen", "10");
  speichern();
  expect(await screen.findByText("Satz 1: 10 Wdh · Körpergewicht")).toBeTruthy();
  expect(log.speichereSatz).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ exerciseId: "ex-liegestuetz", gewichtKg: null }));
});

test("letzter Satz der Übung mit Körpergewicht: Gewicht bleibt leer", async () => {
  log.letzteSaetze.mockImplementation(async (_c: unknown, uebung: string) =>
    uebung === "ex-rudern" ? { ok: true, daten: [{ weight_kg: 20 }] } : { ok: true, daten: [{ weight_kg: null }] },
  );
  zeige();
  const gewicht = screen.getByLabelText("Gewicht (kg)") as HTMLInputElement;
  await vi.waitFor(() => expect(gewicht.value).toBe("20"));
  fireEvent.change(screen.getByLabelText("Übung"), { target: { value: "ex-liegestuetz" } });
  await vi.waitFor(() => expect(gewicht.value).toBe(""));
});
