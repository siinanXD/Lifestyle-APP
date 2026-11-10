import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import EinwilligungenPage from "../../app/(app)/konto/einwilligungen/page";
import { DatenLoeschen, Widerruf } from "../../app/(app)/konto/einwilligungen/widerruf";
import AccountPage from "../../app/(app)/konto/page";

const widerrufe = vi.hoisted(() => vi.fn());
const loescheDaten = vi.hoisted(() => vi.fn());
const zeilen = vi.hoisted(() => ({ data: [] as unknown[] | null, error: null as unknown }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("../../lib/consent/kategorien", async (original) => ({ ...(await original<object>()), widerrufe, loescheDaten }));
vi.mock("../../lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => ({ from: () => ({ select: async () => zeilen }) }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  zeilen.data = [];
  zeilen.error = null;
});

const abschnitt = (titel: string) => screen.getByRole("heading", { name: titel }).closest("section")!;

test("Konto verlinkt die Einwilligungen", () => {
  render(<AccountPage />);
  expect(screen.getByRole("link", { name: "Einwilligungen" }).getAttribute("href")).toBe("/konto/einwilligungen");
});

test("zeigt A bis E mit Status; erteilte mit Datum und Textversion und „Widerrufen“, andere mit „Erteilen“", async () => {
  zeilen.data = [
    { kind: "B", text_version: "2026-10-30", granted_at: "2026-11-05T09:00:00Z", revoked_at: null },
    { kind: "A", text_version: "2026-10-30", granted_at: "2026-11-01T09:00:00Z", revoked_at: "2026-11-02T09:00:00Z" },
  ];
  render(await EinwilligungenPage());
  for (const titel of ["Profil & Gewohnheiten", "Gesundheitsdaten", "Fototagebuch", "Foto-Erkennung", "KI-Coach"]) {
    expect(abschnitt(titel)).toBeTruthy();
  }
  const b = within(abschnitt("Gesundheitsdaten"));
  expect(b.getByText("Erteilt am 05.11.2026 · Textversion 2026-10-30")).toBeTruthy();
  expect(b.getByRole("button", { name: "Widerrufen" })).toBeTruthy();
  const a = within(abschnitt("Profil & Gewohnheiten"));
  expect(a.getByText("Nicht erteilt")).toBeTruthy();
  expect(a.getByRole("link", { name: "Erteilen" }).getAttribute("href")).toBe("/einwilligung/A?next=%2Fkonto%2Feinwilligungen");
  expect(a.queryByRole("button", { name: "Widerrufen" })).toBeNull();
  // Reste nach einem Widerruf bleiben löschbar, auch nach neuem Laden; ohne Daten (C) gibt es den Knopf nicht.
  expect(a.getByRole("button", { name: "Gespeicherte Daten löschen" })).toBeTruthy();
  expect(within(abschnitt("Fototagebuch")).queryByRole("button", { name: "Gespeicherte Daten löschen" })).toBeNull();
  expect(b.queryByRole("button", { name: "Gespeicherte Daten löschen" })).toBeNull();
});

test("„Gespeicherte Daten löschen“ fragt nach, löscht und bestätigt; Fehler wird gemeldet", async () => {
  loescheDaten.mockResolvedValueOnce({ error: { code: "42501" } }).mockResolvedValueOnce({ error: null });
  render(<DatenLoeschen art="B" />);
  fireEvent.click(screen.getByRole("button", { name: "Gespeicherte Daten löschen" }));
  expect(loescheDaten).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Ja, löschen" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/nicht geklappt/);
  fireEvent.click(screen.getByRole("button", { name: "Ja, löschen" }));
  expect((await screen.findByRole("status")).textContent).toMatch(/gelöscht/);
  expect(loescheDaten).toHaveBeenCalledWith(expect.anything(), "B");
});

test("Lesefehler wird nicht als „nicht erteilt“ angezeigt", async () => {
  zeilen.data = null;
  zeilen.error = { code: "XX000" };
  await expect(EinwilligungenPage()).rejects.toThrow("Einwilligungen");
});

test("Widerrufen fragt erst nach; „Daten auch löschen“ ist vorgeschlagen", () => {
  render(<Widerruf art="B" />);
  fireEvent.click(screen.getByRole("button", { name: "Widerrufen" }));
  expect(widerrufe).not.toHaveBeenCalled();
  expect((screen.getByRole("checkbox", { name: "Zugehörige Daten auch löschen" }) as HTMLInputElement).checked).toBe(true);
});

test("mit Löschen: widerruft und löscht, dann neu laden", async () => {
  widerrufe.mockResolvedValue({ error: null });
  render(<Widerruf art="B" />);
  fireEvent.click(screen.getByRole("button", { name: "Widerrufen" }));
  fireEvent.click(screen.getByRole("button", { name: "Ja, widerrufen" }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(widerrufe).toHaveBeenCalledWith(expect.anything(), "B", { datenLoeschen: true });
});

test("ohne Löschen: nur Widerruf", async () => {
  widerrufe.mockResolvedValue({ error: null });
  render(<Widerruf art="B" />);
  fireEvent.click(screen.getByRole("button", { name: "Widerrufen" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Zugehörige Daten auch löschen" }));
  fireEvent.click(screen.getByRole("button", { name: "Ja, widerrufen" }));
  await waitFor(() => expect(refresh).toHaveBeenCalled());
  expect(widerrufe).toHaveBeenCalledWith(expect.anything(), "B", { datenLoeschen: false });
});

test("Abbrechen ändert nichts", () => {
  render(<Widerruf art="B" />);
  fireEvent.click(screen.getByRole("button", { name: "Widerrufen" }));
  fireEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
  expect(widerrufe).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Widerrufen" })).toBeTruthy();
});

test("ohne gespeicherte Daten (D) gibt es keine Löschwahl", () => {
  render(<Widerruf art="D" />);
  fireEvent.click(screen.getByRole("button", { name: "Widerrufen" }));
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(screen.getByText(/keine Daten gespeichert/)).toBeTruthy();
});

test("Fehler wird ruhig gemeldet, nichts neu geladen", async () => {
  widerrufe.mockResolvedValue({ error: { code: "42501" } });
  render(<Widerruf art="B" />);
  fireEvent.click(screen.getByRole("button", { name: "Widerrufen" }));
  fireEvent.click(screen.getByRole("button", { name: "Ja, widerrufen" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/nicht geklappt/);
  expect(refresh).not.toHaveBeenCalled();
});

test("Löschen nach dem Widerruf gescheitert: Meldung nennt den Zwischenstand, erneutes Tippen versucht es noch einmal", async () => {
  widerrufe.mockResolvedValueOnce({ error: { code: "42501" }, widerrufen: true }).mockResolvedValueOnce({ error: null, widerrufen: true });
  render(<Widerruf art="B" />);
  fireEvent.click(screen.getByRole("button", { name: "Widerrufen" }));
  fireEvent.click(screen.getByRole("button", { name: "Ja, widerrufen" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/ist widerrufen.*noch nicht vollständig gelöscht/);
  expect(refresh).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Ja, widerrufen" }));
  await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(widerrufe).toHaveBeenCalledTimes(2);
});
