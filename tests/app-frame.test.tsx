import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test, vi } from "vitest";
import AppLayout from "../app/(app)/layout";
import { AuthForm } from "../app/auth-form";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current, useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(cleanup);

const TABS = [
  ["Heute", "/"],
  ["Training", "/training"],
  ["Essen", "/essen"],
  ["Fortschritt", "/fortschritt"],
  ["Konto", "/konto"],
];

describe("App-Rahmen (SIN-1254)", () => {
  test("Layout rendert fünf Links mit den richtigen Zielen", () => {
    render(<AppLayout>Inhalt</AppLayout>);
    const links = within(screen.getByRole("navigation", { name: "Hauptnavigation" })).getAllByRole("link");
    expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual(TABS);
    expect(screen.getByText("Inhalt")).toBeTruthy();
  });

  test.each(TABS)("%s ist als einziger Tab aktiv, wenn %s offen ist", (name, href) => {
    pathname.current = href;
    render(<AppLayout>x</AppLayout>);
    const current = screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.textContent)).toEqual([name]);
  });

  test("Unterseiten markieren ihren Tab, / nur die Startseite", () => {
    pathname.current = "/training/plan";
    render(<AppLayout>x</AppLayout>);
    expect(screen.getByRole("link", { name: "Training" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Heute" }).getAttribute("aria-current")).toBeNull();
  });

  test("/login rendert ohne Tab-Leiste", () => {
    render(<AuthForm mode="login" />);
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("link", { name: "Training" })).toBeNull();
  });

  test("nur die Routengruppe (app) bindet die Tab-Leiste ein", () => {
    for (const file of ["login/page.tsx", "registrieren/page.tsx", "passwort-neu/page.tsx", "passwort-vergessen/page.tsx", "layout.tsx"]) {
      expect(readFileSync(`app/${file}`, "utf8")).not.toMatch(/tab-bar|TabBar/);
    }
  });
});

describe.each(["training", "essen", "fortschritt"])("Platzhalter /%s", (route) => {
  test("zeigt Überschrift und „Bald hier“", async () => {
    const { default: Page } = await import(`../app/(app)/${route}/page.tsx`);
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.getByText(/Bald hier/)).toBeTruthy();
  });
});
