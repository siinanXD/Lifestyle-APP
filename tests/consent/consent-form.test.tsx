import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ConsentForm } from "../../app/einwilligung/[art]/consent-form";
import { EINWILLIGUNGSTEXTE } from "../../lib/consent/texte";

const erteile = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("../../lib/consent/consent", () => ({ erteileEinwilligung: erteile }));
vi.mock("../../lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("zeigt den Text und eine nicht vorangekreuzte Checkbox", () => {
  render(<ConsentForm art="B" next="/" />);
  expect(screen.getByText(EINWILLIGUNGSTEXTE.B.text)).toBeTruthy();
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
});

test("ohne Haken passiert nichts", () => {
  render(<ConsentForm art="B" next="/training" />);
  fireEvent.click(screen.getByRole("button", { name: "Zustimmen" }));
  expect(erteile).not.toHaveBeenCalled();
  expect(push).not.toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toMatch(/Haken/);
});

test("mit Haken wird erteilt und zur next-Seite zurückgekehrt", async () => {
  erteile.mockResolvedValue({ error: null });
  render(<ConsentForm art="B" next="/training" />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Zustimmen" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/training"));
  expect(erteile).toHaveBeenCalledWith(expect.anything(), "B");
  expect(refresh).toHaveBeenCalled();
});

test("eine fremde next-Adresse führt auf die Startseite", async () => {
  erteile.mockResolvedValue({ error: null });
  render(<ConsentForm art="B" next="//evil.example" />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Zustimmen" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
});

test("bei einem Fehler bleibt man auf der Seite und bekommt eine ruhige Meldung", async () => {
  erteile.mockResolvedValue({ error: { code: "42501" } });
  render(<ConsentForm art="B" next="/training" />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Zustimmen" }));
  expect(await screen.findByText(/nicht geklappt/)).toBeTruthy();
  expect(push).not.toHaveBeenCalled();
});

test("Nicht jetzt geht zurück zur Startseite, ohne zu speichern", () => {
  render(<ConsentForm art="B" next="/training" />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Nicht jetzt" }));
  expect(erteile).not.toHaveBeenCalled();
  expect(push).toHaveBeenCalledWith("/");
});
