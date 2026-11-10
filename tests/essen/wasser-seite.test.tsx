import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import WasserPage from "../../app/(app)/essen/wasser/page";
import { Wasser } from "../../app/(app)/essen/wasser/wasser";

const wasser = vi.hoisted(() => ({ trageWasserEin: vi.fn(), loescheWasser: vi.fn(), wasserSeit: vi.fn() }));
const requireConsent = vi.hoisted(() => vi.fn());
vi.mock("../../lib/essen/wasser", async (original) => ({ ...(await original<object>()), ...wasser }));
vi.mock("../../lib/consent/require-consent", () => ({ requireConsent }));
vi.mock("../../lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => ({}) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const heute = (h: number, m: number) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const summe = () => screen.getByTestId("tagessumme").textContent;
const eintraege = () => within(screen.getByRole("list", { name: "Einträge heute" })).queryAllByRole("listitem");

test("ohne Einwilligung B wird umgeleitet und nichts geladen", async () => {
  requireConsent.mockRejectedValue(new Error("NEXT_REDIRECT"));
  await expect(WasserPage()).rejects.toThrow("NEXT_REDIRECT");
  expect(requireConsent).toHaveBeenCalledWith("B", "/essen/wasser");
  expect(wasser.wasserSeit).not.toHaveBeenCalled();
});

test("mit B lädt die Seite die letzten Tage und zeigt die Tagessumme", async () => {
  requireConsent.mockResolvedValue(undefined);
  wasser.wasserSeit.mockResolvedValue({ ok: true, daten: [{ id: "a", amount_ml: 500, logged_at: heute(0, 1) }] });
  render(await WasserPage());
  expect(summe()).toBe("500 ml");
  expect(eintraege()).toHaveLength(1);
  const seit = new Date(wasser.wasserSeit.mock.calls[0][1] as string).getTime();
  expect(Date.now() - seit).toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000);
});

test("ohne Einträge ist die Summe 0 ml", () => {
  render(<Wasser eintraege={[]} />);
  expect(summe()).toBe("0 ml");
  expect(screen.getByText("Heute noch nichts eingetragen.")).toBeTruthy();
});

test("Schnelltaste fügt genau einen Eintrag mit der richtigen Menge hinzu", async () => {
  wasser.trageWasserEin.mockResolvedValue({ ok: true, daten: { id: "n1", amount_ml: 250, logged_at: new Date().toISOString() } });
  render(<Wasser eintraege={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "+ 250 ml" }));
  expect(await screen.findByRole("list", { name: "Einträge heute" })).toBeTruthy();
  expect(eintraege()[0].textContent).toMatch(/^250 ml/);
  expect(wasser.trageWasserEin).toHaveBeenCalledTimes(1);
  expect(wasser.trageWasserEin).toHaveBeenCalledWith(expect.anything(), 250, { id: expect.any(String) });
  expect(summe()).toBe("250 ml");
  expect(eintraege()).toHaveLength(1);
});

test.each(["0", "5001", "abc"])("freies Feld lehnt %s ab und schreibt nichts", (wert) => {
  render(<Wasser eintraege={[]} />);
  fireEvent.change(screen.getByLabelText("Menge (ml)"), { target: { value: wert } });
  fireEvent.click(screen.getByRole("button", { name: "Eintragen" }));
  expect(screen.getByRole("alert").textContent).toMatch(/1 bis 5000/);
  expect(wasser.trageWasserEin).not.toHaveBeenCalled();
});

test("freies Feld trägt eine gültige Menge ein", async () => {
  wasser.trageWasserEin.mockResolvedValue({ ok: true, daten: { id: "n2", amount_ml: 330, logged_at: new Date().toISOString() } });
  render(<Wasser eintraege={[]} />);
  fireEvent.change(screen.getByLabelText("Menge (ml)"), { target: { value: "330" } });
  fireEvent.click(screen.getByRole("button", { name: "Eintragen" }));
  expect(await screen.findByRole("list", { name: "Einträge heute" })).toBeTruthy();
  expect(eintraege()[0].textContent).toMatch(/^330 ml/);
  expect(wasser.trageWasserEin).toHaveBeenCalledWith(expect.anything(), 330, { id: expect.any(String) });
});

test("Fehler beim Speichern wird ruhig gemeldet, Summe bleibt", async () => {
  wasser.trageWasserEin.mockResolvedValue({ ok: false, fehler: "netz" });
  render(<Wasser eintraege={[]} />);
  fireEvent.click(screen.getByRole("button", { name: "+ 500 ml" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/nicht geklappt/);
  expect(summe()).toBe("0 ml");
});

test("Löschen entfernt den Eintrag und senkt die Summe", async () => {
  wasser.loescheWasser.mockResolvedValue({ ok: true, daten: null });
  render(<Wasser eintraege={[{ id: "a", amount_ml: 500, logged_at: heute(9, 0) }, { id: "b", amount_ml: 250, logged_at: heute(10, 0) }]} />);
  expect(summe()).toBe("750 ml");
  fireEvent.click(within(eintraege()[0]).getByRole("button", { name: "Löschen" }));
  await vi.waitFor(() => expect(eintraege()).toHaveLength(1));
  expect(wasser.loescheWasser).toHaveBeenCalledWith(expect.anything(), "b");
  expect(summe()).toBe("500 ml");
});

test("Verlauf zeigt die letzten 7 Tage", () => {
  render(<Wasser eintraege={[]} />);
  expect(within(screen.getByRole("list", { name: "Verlauf der letzten 7 Tage" })).getAllByRole("listitem")).toHaveLength(7);
});
