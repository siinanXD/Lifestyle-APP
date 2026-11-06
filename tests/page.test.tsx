import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import Page from "../app/(app)/page";

const redirect = vi.hoisted(() => vi.fn(() => {
  throw new Error("NEXT_REDIRECT");
}));
const profil = vi.hoisted(() => ({ data: null as unknown, error: null as unknown }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("../lib/supabase/server", () => ({
  createClient: async () => ({ from: () => ({ select: () => ({ maybeSingle: async () => profil }) }) }),
}));

beforeEach(() => {
  redirect.mockClear();
  profil.error = null;
});

test("Startseite zeigt Platzhaltertext, wenn das Onboarding abgeschlossen ist", async () => {
  profil.data = { onboarding_completed_at: "2026-11-06T12:00:00Z" };
  render(await Page());
  expect(redirect).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { level: 1, name: "Lifestyle App" })).toBeTruthy();
  expect(screen.getByText("Dein ruhiger Lifestyle-Coach. Bald hier.")).toBeTruthy();
});

test("neues Konto ohne onboarding_completed_at wird ins Onboarding geleitet", async () => {
  profil.data = { onboarding_completed_at: null };
  await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
  expect(redirect).toHaveBeenCalledWith("/onboarding");
});

test("Konto ohne Profilzeile wird ebenfalls ins Onboarding geleitet", async () => {
  profil.data = null;
  await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
  expect(redirect).toHaveBeenCalledWith("/onboarding");
});

test("Lesefehler leitet nicht um, sondern bricht ab", async () => {
  profil.data = null;
  profil.error = { code: "PGRST000" };
  await expect(Page()).rejects.toThrow("Profil konnte nicht geladen werden");
  expect(redirect).not.toHaveBeenCalled();
});
