import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import ConsentPage from "../../app/einwilligung/[art]/page";

const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
vi.mock("next/navigation", () => ({ notFound, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("../../lib/supabase/client", () => ({ createClient: () => ({}) }));

test("zeigt Titel und Formular für eine bekannte Art", async () => {
  render(await ConsentPage({ params: Promise.resolve({ art: "B" }), searchParams: Promise.resolve({ next: "/x" }) }));
  expect(screen.getByRole("heading", { level: 1, name: "Gesundheitsdaten" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Zustimmen" })).toBeTruthy();
});

test("unbekannte Art gibt 404", async () => {
  await expect(ConsentPage({ params: Promise.resolve({ art: "Z" }), searchParams: Promise.resolve({}) })).rejects.toThrow(
    "NEXT_NOT_FOUND",
  );
});
