import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import Page from "../app/willkommen/page";

afterEach(cleanup);

test("zeigt Produktname, Beta-Hinweis und beide Wege mit richtigen Zielen", () => {
  render(<Page />);
  expect(screen.getByRole("heading", { level: 1, name: "Lifestyle App" })).toBeTruthy();
  expect(screen.getByText("Dein ruhiger Lifestyle-Coach.")).toBeTruthy();
  expect(screen.getByText(/Geschlossene Beta/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Konto anlegen" }).getAttribute("href")).toBe("/registrieren");
  expect(screen.getByRole("link", { name: "Anmelden" }).getAttribute("href")).toBe("/login");
});

test("nennt Training, Ernährung/Schlaf/Gewohnheiten und Fortschritt ohne Druck", () => {
  render(<Page />);
  expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
    expect.stringContaining("Training"),
    expect.stringMatching(/Ernährung.*Schlaf.*Gewohnheiten/),
    expect.stringMatching(/Fortschritt.*ohne Druck/),
  ]);
});

test("enthält kein Wort aus der Verbotsliste und hat keine Tab-Leiste", () => {
  const { container } = render(<Page />);
  expect(container.textContent).not.toMatch(/musst|solltest|verpasst|Streak|noch nicht/i);
  expect(screen.queryByRole("navigation")).toBeNull();
});

test("beide Wege sind gleich groß gestaltet (gleiche Knopf-Klasse)", () => {
  render(<Page />);
  const classes = screen.getAllByRole("link").map((a) => a.className);
  expect(new Set(classes).size).toBe(1);
  expect(classes[0]).toContain("btn");
});
