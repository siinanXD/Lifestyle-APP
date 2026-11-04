import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const state = vi.hoisted(() => ({ rows: [] as { amount_ml: number; logged_at: string }[], error: null as null | { message: string } }));

vi.mock("../lib/supabase/server", () => ({
  createClient: async () => ({
    from: (tabelle: string) => {
      expect(tabelle).toBe("water_logs");
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.gte = () => q;
      q.order = () => Promise.resolve({ data: state.error ? null : state.rows, error: state.error });
      return q;
    },
  }),
}));

import Page from "../app/page";

afterEach(cleanup);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
  state.rows = [];
  state.error = null;
});

test("Startseite zeigt Titel und leere Wasserkarte für ein Konto ohne Daten", async () => {
  render(await Page());
  expect(screen.getByRole("heading", { level: 1, name: "Lifestyle App" })).toBeTruthy();
  expect(screen.getByText("0 von 8 Gläsern, ohne Druck")).toBeTruthy();
  expect(screen.getByText("Noch keine Einträge in den letzten sieben Tagen.")).toBeTruthy();
});

test("Startseite zeigt Gläser heute und sieben Tage Verlauf aus water_logs", async () => {
  state.rows = [
    { amount_ml: 500, logged_at: "2026-11-03T08:00:00.000Z" },
    { amount_ml: 500, logged_at: "2026-11-03T10:00:00.000Z" },
    { amount_ml: 350, logged_at: "2026-11-02T10:00:00.000Z" },
  ];
  render(await Page());
  expect(screen.getByText("4 von 8 Gläsern, ohne Druck")).toBeTruthy();
  expect(screen.getAllByRole("listitem")).toHaveLength(7);
  expect(screen.getByText("350 ml", { exact: false, selector: "li" })).toBeTruthy();
});

test("Lesefehler wird sichtbar gemeldet, nicht als leere Karte gezeigt", async () => {
  state.error = { message: "kaputt" };
  render(await Page());
  expect(screen.getByRole("alert").textContent).toContain("Wasserdaten konnten nicht geladen werden");
  expect(screen.queryByText(/von 8 Gläsern/)).toBeNull();
});
