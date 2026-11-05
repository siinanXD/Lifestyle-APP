import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AuthForm } from "../../app/auth-form";
import { DeleteAccount } from "../../app/(app)/konto/delete-account";
import AccountPage from "../../app/(app)/konto/page";
import { NewPasswordForm } from "../../app/passwort-neu/new-password-form";
import { ForgotPasswordForm } from "../../app/passwort-vergessen/forgot-password-form";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("../../lib/supabase/client", () => ({ createClient: () => ({ rpc, auth: {} }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Titel (SIN-1572)", () => {
  test("/login: Produktname klein darüber, Titel „Anmelden“, kein „Willkommen zurück“", () => {
    const { container } = render(<AuthForm mode="login" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Anmelden");
    expect(screen.getByText("Lifestyle App")).toBeTruthy();
    expect(container.textContent).not.toContain("Willkommen zurück");
  });

  test("/registrieren: Titel „Konto anlegen“", () => {
    render(<AuthForm mode="register" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Konto anlegen");
    expect(screen.getByText("Lifestyle App")).toBeTruthy();
  });
});

describe("Design-Klassen statt Inline-Styles", () => {
  const pages = {
    login: <AuthForm mode="login" />,
    registrieren: <AuthForm mode="register" />,
    "passwort-vergessen": <ForgotPasswordForm />,
    "passwort-neu": <NewPasswordForm />,
    konto: <AccountPage />,
  };
  test.each(Object.entries(pages))("%s hat kein style-Attribut", (_, page) => {
    const { container } = render(page);
    expect(container.querySelectorAll("[style]")).toHaveLength(0);
  });

  test.each(Object.entries(pages))("%s: Knöpfe, Eingaben und Links tragen Design-Klassen", (_, page) => {
    render(page);
    for (const b of screen.queryAllByRole("button")) expect(b.className).toContain("btn");
    for (const i of document.querySelectorAll("input:not([type=checkbox])")) expect(i.className).toContain("input");
    for (const a of screen.queryAllByRole("link")) expect(a.className).toContain("link");
  });

  test("„Passwort anzeigen“ ist ein Schalter in einem großen, klickbaren Label", () => {
    render(<AuthForm mode="login" />);
    const toggle = screen.getByRole("switch", { name: "Passwort anzeigen" });
    expect(toggle.closest("label")?.className).toContain("toggle");
    fireEvent.click(screen.getByText("Passwort anzeigen"));
    expect((screen.getByLabelText("Passwort") as HTMLInputElement).type).toBe("text");
  });
});

describe("Konto löschen als Gefahrenaktion", () => {
  test("„Konto löschen“ trägt den Gefahrenstil, die Rückfrage kommt weiter vor dem Löschen", () => {
    render(<DeleteAccount />);
    const open = screen.getByRole("button", { name: "Konto löschen" });
    expect(open.getAttribute("data-variant")).toBe("danger");
    fireEvent.click(open);
    expect(rpc).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ja, alle meine Daten löschen" }).getAttribute("data-variant")).toBe("danger");
  });

  test("„Abbrechen“ ist neutral und gleich groß (gleiche Klasse)", () => {
    render(<DeleteAccount />);
    fireEvent.click(screen.getByRole("button", { name: "Konto löschen" }));
    const yes = screen.getByRole("button", { name: "Ja, alle meine Daten löschen" });
    const cancel = screen.getByRole("button", { name: "Abbrechen" });
    expect(cancel.getAttribute("data-variant")).toBe("neutral");
    expect(cancel.className).toBe(yes.className);
  });
});
