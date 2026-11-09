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
const gesundheit = vi.hoisted(() => vi.fn());
const koerper = vi.hoisted(() => vi.fn());
vi.mock("../../lib/onboarding/speichern", () => ({
  speichereProfil: speichere,
  speichereGesundheit: gesundheit,
  speichereKoerperwerte: koerper,
}));
vi.mock("../../lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const neu = { volljaehrig: false, einwilligungA: false, einwilligungB: false, antworten: {} };
const bereit = { volljaehrig: true, einwilligungA: true, einwilligungB: false, antworten: {} };
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
  expect(await screen.findByRole("heading", { level: 1, name: FRAGEN.zusammenfassung })).toBeTruthy();
  expect(screen.queryByText(FRAGEN.ziele)).toBeNull();
  expect(erteile).not.toHaveBeenCalled();
  expect(speichere).not.toHaveBeenCalled();
  expect(screen.getAllByRole("listitem").filter((li) => li.textContent?.endsWith("nicht angegeben"))).toHaveLength(5);
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

const ueberspringe = (mal: number) => {
  for (let i = 0; i < mal; i++) fireEvent.click(screen.getByRole("button", { name: "Überspringen" }));
};

test("nach der Erfahrung kommt Schritt 4 Einschränkungen", async () => {
  speichere.mockResolvedValue({ error: null });
  render(<Onboarding start={bereit} />);
  ueberspringe(2);
  fireEvent.click(screen.getByRole("radio", { name: "Ich fange an" }));
  weiter();
  expect(await screen.findByRole("heading", { level: 1, name: FRAGEN.einschraenkungen })).toBeTruthy();
  expect(speichere).toHaveBeenCalledWith(expect.anything(), { experience: "anfaenger" });
});

test("Schritt 4 ohne Einwilligung B: Angaben gesperrt, nichts in health_profile, Weiter geht", async () => {
  render(<Onboarding start={bereit} />);
  ueberspringe(3);
  expect(screen.getByText(EINWILLIGUNGSTEXTE.B.text)).toBeTruthy();
  expect(screen.getByText("Bei Schmerzen frag bitte ärztlichen Rat; die App stellt keine Diagnosen.")).toBeTruthy();
  expect((screen.getByRole("checkbox", { name: "Knie" }) as HTMLInputElement).disabled).toBe(true);
  weiter();
  expect(await screen.findByRole("heading", { level: 1, name: FRAGEN.geraete })).toBeTruthy();
  expect(gesundheit).not.toHaveBeenCalled();
  expect(erteile).not.toHaveBeenCalled();
});

test("Schritt 4 mit Einwilligung B: Auswahl wird gespeichert; „Nein“ schließt andere Auswahl aus", async () => {
  erteile.mockResolvedValue({ error: null });
  gesundheit.mockResolvedValue({ error: null });
  render(<Onboarding start={bereit} />);
  ueberspringe(3);
  fireEvent.click(screen.getByRole("checkbox", { name: "Ich willige ausdrücklich ein." }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Knie" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Nein / möchte ich nicht sagen" }));
  expect((screen.getByRole("checkbox", { name: "Knie" }) as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByRole("checkbox", { name: "Rücken" }));
  expect((screen.getByRole("checkbox", { name: "Nein / möchte ich nicht sagen" }) as HTMLInputElement).checked).toBe(false);
  expect((screen.getByLabelText(/Kurztext/) as HTMLTextAreaElement).autocomplete).toBe("off");
  weiter();
  await screen.findByRole("heading", { level: 1, name: FRAGEN.geraete });
  expect(erteile).toHaveBeenCalledWith(expect.anything(), "B");
  expect(gesundheit).toHaveBeenCalledWith(expect.anything(), { restrictions: ["ruecken"] });
});

test("gespeicherte Einschränkung: „Nein“ leert sie in der Datenbank, die Zusammenfassung stimmt", async () => {
  gesundheit.mockResolvedValue({ error: null });
  render(<Onboarding start={{ ...bereit, einwilligungB: true, antworten: { einschraenkungen: ["knie"] } }} />);
  ueberspringe(3);
  fireEvent.click(screen.getByRole("checkbox", { name: "Nein / möchte ich nicht sagen" }));
  weiter();
  await screen.findByRole("heading", { level: 1, name: FRAGEN.geraete });
  expect(gesundheit).toHaveBeenCalledWith(expect.anything(), { restrictions: [] });
  expect(erteile).not.toHaveBeenCalled();
  ueberspringe(2);
  await screen.findByRole("heading", { level: 1, name: FRAGEN.zusammenfassung });
  expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toContain("Rücksicht: nicht angegeben");
});

test("gespeicherte Ziele und Notiz: Abwählen und Löschen wird gespeichert", async () => {
  speichere.mockResolvedValue({ error: null });
  render(<Onboarding start={{ ...bereit, antworten: { ziele: ["kraeftiger"], zielNotiz: "Platzhalter" } }} />);
  fireEvent.click(screen.getByRole("button", { name: "Kräftiger werden" }));
  fireEvent.change(screen.getByLabelText(/In deinen Worten/), { target: { value: "" } });
  weiter();
  await screen.findByRole("heading", { level: 1, name: FRAGEN.zeit });
  expect(speichere).toHaveBeenCalledWith(expect.anything(), { goals: [], goal_note: null });
});

test("Überspringen nach dem Abwählen lässt die gespeicherte Antwort stehen", () => {
  render(<Onboarding start={{ ...bereit, antworten: { ziele: ["kraeftiger"] } }} />);
  fireEvent.click(screen.getByRole("button", { name: "Kräftiger werden" }));
  fireEvent.click(screen.getByRole("button", { name: "Überspringen" }));
  expect(frage(FRAGEN.zeit)).toBeTruthy();
  expect(speichere).not.toHaveBeenCalled();
});

test("ohne gespeicherte Einschränkung: Haken B und „Nein“ erteilen B nicht und legen keine Zeile an", async () => {
  render(<Onboarding start={bereit} />);
  ueberspringe(3);
  fireEvent.click(screen.getByRole("checkbox", { name: "Ich willige ausdrücklich ein." }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Nein / möchte ich nicht sagen" }));
  weiter();
  await screen.findByRole("heading", { level: 1, name: FRAGEN.geraete });
  expect(erteile).not.toHaveBeenCalled();
  expect(gesundheit).not.toHaveBeenCalled();
});

test("ohne gespeicherte Notiz: getippt und wieder geleert erteilt B nicht und legt keine Zeile an", async () => {
  render(<Onboarding start={bereit} />);
  ueberspringe(3);
  fireEvent.click(screen.getByRole("checkbox", { name: "Ich willige ausdrücklich ein." }));
  fireEvent.change(screen.getByLabelText(/Kurztext/), { target: { value: "Platzhalter" } });
  fireEvent.change(screen.getByLabelText(/Kurztext/), { target: { value: "" } });
  weiter();
  await screen.findByRole("heading", { level: 1, name: FRAGEN.geraete });
  expect(erteile).not.toHaveBeenCalled();
  expect(gesundheit).not.toHaveBeenCalled();
});

test("ohne gespeicherte Ziele: an- und wieder abgewählt schreibt nichts ins Profil", async () => {
  render(<Onboarding start={bereit} />);
  fireEvent.click(screen.getByRole("button", { name: "Kräftiger werden" }));
  fireEvent.click(screen.getByRole("button", { name: "Kräftiger werden" }));
  weiter();
  await screen.findByRole("heading", { level: 1, name: FRAGEN.zeit });
  expect(speichere).not.toHaveBeenCalled();
});

test("gespeicherte Notiz: Leeren schreibt null, ohne B neu zu erteilen", async () => {
  gesundheit.mockResolvedValue({ error: null });
  render(<Onboarding start={{ ...bereit, einwilligungB: true, antworten: { einschraenkungNotiz: "Platzhalter" } }} />);
  ueberspringe(3);
  fireEvent.change(screen.getByLabelText(/Kurztext/), { target: { value: "" } });
  weiter();
  await screen.findByRole("heading", { level: 1, name: FRAGEN.geraete });
  expect(gesundheit).toHaveBeenCalledWith(expect.anything(), { restriction_note: null });
  expect(erteile).not.toHaveBeenCalled();
});

test("in dieser Sitzung gespeicherte Einschränkung lässt sich leeren, zweites Leeren schreibt nicht mehr", async () => {
  gesundheit.mockResolvedValue({ error: null });
  render(<Onboarding start={{ ...bereit, einwilligungB: true }} />);
  ueberspringe(3);
  fireEvent.click(screen.getByRole("checkbox", { name: "Knie" }));
  weiter();
  await screen.findByRole("heading", { level: 1, name: FRAGEN.geraete });
  expect(gesundheit).toHaveBeenLastCalledWith(expect.anything(), { restrictions: ["knie"] });

  fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Knie" }));
  weiter();
  await waitFor(() => expect(gesundheit).toHaveBeenCalledTimes(2));
  expect(gesundheit).toHaveBeenLastCalledWith(expect.anything(), { restrictions: [] });
  await screen.findByRole("heading", { level: 1, name: FRAGEN.geraete });

  fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
  weiter();
  await screen.findByRole("heading", { level: 1, name: FRAGEN.geraete });
  expect(gesundheit).toHaveBeenCalledTimes(2);
});

test("Überspringen nach „Nein“ lässt die gespeicherte Einschränkung stehen", () => {
  render(<Onboarding start={{ ...bereit, einwilligungB: true, antworten: { einschraenkungen: ["knie"] } }} />);
  ueberspringe(3);
  fireEvent.click(screen.getByRole("checkbox", { name: "Nein / möchte ich nicht sagen" }));
  fireEvent.click(screen.getByRole("button", { name: "Überspringen" }));
  expect(frage(FRAGEN.geraete)).toBeTruthy();
  expect(gesundheit).not.toHaveBeenCalled();
  expect(erteile).not.toHaveBeenCalled();
});

test("Schritt 5 speichert die Geräte mit festen Schlüsseln", async () => {
  speichere.mockResolvedValue({ error: null });
  render(<Onboarding start={bereit} />);
  ueberspringe(4);
  fireEvent.click(screen.getByRole("checkbox", { name: "Kurzhanteln" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Kardiogerät" }));
  weiter();
  await screen.findByRole("heading", { level: 1, name: FRAGEN.freiwillig });
  expect(speichere).toHaveBeenCalledWith(expect.anything(), { equipment: ["kurzhanteln", "kardio"] });
});

test("Schritt 6: Schalter aus, Coach ausgegraut; Körperwerte mit B speichern Gewicht und Größe getrennt", async () => {
  gesundheit.mockResolvedValue({ error: null });
  koerper.mockResolvedValue({ error: null });
  render(<Onboarding start={{ ...bereit, einwilligungB: true }} />);
  ueberspringe(5);
  const schalter = screen.getAllByRole("switch") as HTMLButtonElement[];
  expect(schalter.map((s) => s.getAttribute("aria-checked"))).toEqual(["false", "false", "false"]);
  expect(screen.getByRole("switch", { name: /KI-Coach/ }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("switch", { name: /Körperwerte/ }));
  fireEvent.change(screen.getByLabelText("Gewicht (kg)"), { target: { value: "80" } });
  fireEvent.change(screen.getByLabelText("Größe (cm)"), { target: { value: "180" } });
  weiter();
  await screen.findByRole("heading", { level: 1, name: FRAGEN.zusammenfassung });
  expect(koerper).toHaveBeenCalledWith(expect.anything(), { weight_kg: 80 });
  expect(gesundheit).toHaveBeenCalledWith(expect.anything(), { height_cm: 180 });
});

test("Schritt 6 ohne B: kein Eintrag in body_measurements oder health_profile, Weiter geht", async () => {
  render(<Onboarding start={bereit} />);
  ueberspringe(5); // B bleibt offen; in Schritt 6 Körperwerte ein, aber ohne Haken B
  fireEvent.click(screen.getByRole("switch", { name: /Körperwerte/ }));
  expect((screen.getByLabelText("Gewicht (kg)") as HTMLInputElement).disabled).toBe(true);
  weiter();
  await screen.findByRole("heading", { level: 1, name: FRAGEN.zusammenfassung });
  expect(koerper).not.toHaveBeenCalled();
  expect(gesundheit).not.toHaveBeenCalled();
});

test("Zusammenfassung zeigt nur Gespeichertes, Übersprungenes als „nicht angegeben“", async () => {
  speichere.mockResolvedValue({ error: null });
  render(<Onboarding start={bereit} />);
  fireEvent.click(screen.getByRole("button", { name: "Mehr Ausdauer" }));
  weiter();
  await screen.findByRole("heading", { level: 1, name: FRAGEN.zeit });
  fireEvent.click(screen.getByRole("radio", { name: "3" }));
  ueberspringe(1); // Zeit gewählt, aber übersprungen: nicht gespeichert
  ueberspringe(4);
  await screen.findByRole("heading", { level: 1, name: FRAGEN.zusammenfassung });
  const zeilen = screen.getAllByRole("listitem").map((li) => li.textContent);
  expect(zeilen).toContain("Ziel: Mehr Ausdauer");
  expect(zeilen).toContain("Zeit: nicht angegeben");
  expect(zeilen).toContain("Rücksicht: nicht angegeben");
  fireEvent.click(screen.getByRole("button", { name: "Plan erstellen" }));
  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/training"));
  expect(speichere).toHaveBeenLastCalledWith(expect.anything(), { onboarding_completed_at: expect.any(String) });
});

test("Zusammenfassung: Ohne Plan starten führt zur Startseite, Ändern zurück zu den Zielen", async () => {
  speichere.mockResolvedValue({ error: null });
  render(<Onboarding start={bereit} />);
  ueberspringe(6);
  await screen.findByRole("heading", { level: 1, name: FRAGEN.zusammenfassung });
  fireEvent.click(screen.getByRole("button", { name: "Ändern" }));
  expect(frage(FRAGEN.ziele)).toBeTruthy();
  ueberspringe(6);
  fireEvent.click(screen.getByRole("button", { name: "Ohne Plan starten" }));
  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  expect(speichere).toHaveBeenCalledWith(expect.anything(), { onboarding_completed_at: expect.any(String) });
});

test("Alles überspringen setzt nur den Abschluss-Zeitstempel und führt zur Startseite", async () => {
  speichere.mockResolvedValue({ error: null });
  render(<Onboarding start={bereit} />);
  fireEvent.click(screen.getByRole("button", { name: "Mehr Ausdauer" }));
  fireEvent.click(screen.getByRole("button", { name: "Alles überspringen" }));
  await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  expect(speichere).toHaveBeenCalledTimes(1);
  expect(speichere).toHaveBeenCalledWith(expect.anything(), { onboarding_completed_at: expect.any(String) });
  expect(erteile).not.toHaveBeenCalled();
  expect(gesundheit).not.toHaveBeenCalled();
  expect(koerper).not.toHaveBeenCalled();
});

test("Abschluss scheitert: man bleibt und bekommt eine ruhige Meldung", async () => {
  speichere.mockResolvedValue({ error: { code: "42501" } });
  render(<Onboarding start={bereit} />);
  fireEvent.click(screen.getByRole("button", { name: "Alles überspringen" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(push).not.toHaveBeenCalled();
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
  expect(screen.getByLabelText("Schritt 2 von 8")).toBeTruthy();
  expect(screen.queryByRole("progressbar")).toBeNull();
});
