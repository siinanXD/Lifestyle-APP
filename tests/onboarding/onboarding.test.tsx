import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { Onboarding } from "../../app/onboarding/onboarding";
import { EINWILLIGUNGSTEXTE } from "../../lib/consent/texte";
import { FRAGEN } from "../../lib/onboarding/texte";

const erteile = vi.hoisted(() => vi.fn());
const speichere = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("../../lib/consent/consent", () => ({ erteileEinwilligung: erteile }));
vi.mock("../../lib/onboarding/speichern", () => ({ speichereProfil: speichere }));
vi.mock("../../lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const neu = { volljaehrig: false, einwilligungA: false, antworten: {} };
const bereit = { volljaehrig: true, einwilligungA: true, antworten: {} };
const weiter = () => fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
const frage = (text: string) => screen.getByRole("heading", { level: 1, name: text });

test("ohne Volljährigkeits-Haken ist Weiter gesperrt", () => {
  render(<Onboarding start={neu} />);
  expect((screen.getByRole("button", { name: "Weiter" }) as HTMLButtonElement).disabled).toBe(true);
  expect(speichere).not.toHaveBeenCalled();
});

test("mit Haken wird die Volljährigkeit gespeichert und Willkommen mit Text A gezeigt", async () => {
  speichere.mockResolvedValue({ error: null });
  render(<Onboarding start={neu} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Ich bin volljährig." }));
  weiter();
  expect(await screen.findByText(EINWILLIGUNGSTEXTE.A.text)).toBeTruthy();
  expect(speichere).toHaveBeenCalledWith(expect.anything(), { adult_confirmed_at: expect.any(String) });
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
});

test("ohne Einwilligung A keine Schritte 1 bis 3 und nichts gespeichert", async () => {
  render(<Onboarding start={{ ...neu, volljaehrig: true }} />);
  fireEvent.click(screen.getByRole("button", { name: "Los geht's" }));
  expect(screen.getByRole("alert").textContent).toMatch(/Haken/);
  fireEvent.click(screen.getByRole("button", { name: "Überspringen" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  expect(screen.queryByText(FRAGEN.ziele)).toBeNull();
  expect(erteile).not.toHaveBeenCalled();
  expect(speichere).not.toHaveBeenCalled();
});

test("mit Einwilligung A geht es zu den Zielen", async () => {
  erteile.mockResolvedValue({ error: null });
  render(<Onboarding start={{ ...neu, volljaehrig: true }} />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Los geht's" }));
  expect(await screen.findByRole("heading", { level: 1, name: FRAGEN.ziele })).toBeTruthy();
  expect(erteile).toHaveBeenCalledWith(expect.anything(), "A");
});

test("Überspringen eines Schritts speichert nichts für diesen Schritt", () => {
  render(<Onboarding start={bereit} />);
  fireEvent.click(screen.getByRole("button", { name: "Mehr Ausdauer" }));
  fireEvent.click(screen.getByRole("button", { name: "Überspringen" }));
  expect(frage(FRAGEN.zeit)).toBeTruthy();
  expect(speichere).not.toHaveBeenCalled();
});

test("Weiter speichert nur die Felder des Schritts, Zurück zeigt die gespeicherte Antwort", async () => {
  speichere.mockResolvedValue({ error: null });
  render(<Onboarding start={bereit} />);
  fireEvent.click(screen.getByRole("button", { name: "Mehr Ausdauer" }));
  weiter();
  await screen.findByRole("heading", { level: 1, name: FRAGEN.zeit });
  expect(speichere).toHaveBeenCalledWith(expect.anything(), { goals: ["mehr_ausdauer"] });

  fireEvent.click(screen.getByRole("radio", { name: "3" }));
  fireEvent.click(screen.getByRole("radio", { name: "30 Min" }));
  weiter();
  await screen.findByRole("heading", { level: 1, name: FRAGEN.erfahrung });
  expect(speichere).toHaveBeenLastCalledWith(expect.anything(), { days_per_week: 3, minutes_per_session: 30 });

  fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
  fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
  expect(screen.getByRole("button", { name: "Mehr Ausdauer" }).getAttribute("aria-pressed")).toBe("true");
});

test("gespeicherte Antworten vom Server sind vorausgewählt", () => {
  render(<Onboarding start={{ ...bereit, antworten: { ziele: ["kraeftiger"] } }} />);
  expect(screen.getByRole("button", { name: "Kräftiger werden" }).getAttribute("aria-pressed")).toBe("true");
});

test("Chips begrenzen auf 3", () => {
  render(<Onboarding start={bereit} />);
  for (const name of ["Mehr Ausdauer", "Breitere Schultern", "Kräftiger werden", "Beweglicher werden"]) {
    fireEvent.click(screen.getByRole("button", { name }));
  }
  const gedrueckt = screen.getAllByRole("button", { pressed: true });
  expect(gedrueckt).toHaveLength(3);
  expect((screen.getByRole("button", { name: "Beweglicher werden" }) as HTMLButtonElement).disabled).toBe(true);
});

test("Freitext länger als 200 Zeichen wird nicht angenommen", () => {
  render(<Onboarding start={bereit} />);
  const feld = screen.getByLabelText(/In deinen Worten/) as HTMLTextAreaElement;
  expect(feld.maxLength).toBe(200);
  fireEvent.change(feld, { target: { value: "x".repeat(201) } });
  expect(feld.value).toBe("");
  fireEvent.change(feld, { target: { value: "x".repeat(200) } });
  expect(feld.value).toHaveLength(200);
  expect(screen.getByText("Bitte keine Diagnosen oder Medikamente eintragen.")).toBeTruthy();
});

test("nach der Erfahrung geht es vorerst zur Startseite (Schritte 4 bis 6 folgen in SIN-1264)", async () => {
  speichere.mockResolvedValue({ error: null });
  render(<Onboarding start={{ ...bereit, antworten: {} }} />);
  fireEvent.click(screen.getByRole("button", { name: "Überspringen" }));
  fireEvent.click(screen.getByRole("button", { name: "Überspringen" }));
  fireEvent.click(screen.getByRole("radio", { name: "Ich fange an" }));
  weiter();
  await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  expect(speichere).toHaveBeenCalledWith(expect.anything(), { experience: "anfaenger" });
});

test("Alles überspringen führt sofort zur Startseite, ohne zu speichern", () => {
  render(<Onboarding start={bereit} />);
  fireEvent.click(screen.getByRole("button", { name: "Alles überspringen" }));
  expect(push).toHaveBeenCalledWith("/");
  expect(speichere).not.toHaveBeenCalled();
});

test("Fehler beim Speichern: man bleibt im Schritt und bekommt eine ruhige Meldung", async () => {
  speichere.mockResolvedValue({ error: { code: "42501" } });
  render(<Onboarding start={bereit} />);
  fireEvent.click(screen.getByRole("button", { name: "Mehr Ausdauer" }));
  weiter();
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(frage(FRAGEN.ziele)).toBeTruthy();
});

test("Fortschritt als Punkte mit Textangabe, kein Prozentbalken", () => {
  render(<Onboarding start={bereit} />);
  expect(screen.getByLabelText("Schritt 2 von 4")).toBeTruthy();
  expect(screen.queryByRole("progressbar")).toBeNull();
});
