import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ForgotPasswordForm } from "../../app/passwort-vergessen/forgot-password-form";
import { NewPasswordForm } from "../../app/passwort-neu/new-password-form";

const auth = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn(), updateUser: vi.fn() }));
const push = vi.hoisted(() => vi.fn());
vi.mock("../../lib/supabase/client", () => ({ createClient: () => ({ auth }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Passwort vergessen", () => {
  const submit = (email: string) => {
    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: email } });
    fireEvent.click(screen.getByRole("button", { name: "Link schicken" }));
  };

  test("verlangt eine E-Mail-Adresse", async () => {
    render(<ForgotPasswordForm />);
    submit("");
    expect(await screen.findByText("Bitte gib deine E-Mail-Adresse ein.")).toBeTruthy();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  test("schickt den Link mit redirectTo auf /passwort-neu der eigenen Origin und verrät nichts", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    render(<ForgotPasswordForm />);
    submit("a@example.test");
    expect(await screen.findByText(/Wenn es zu dieser Adresse ein Konto gibt/)).toBeTruthy();
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("a@example.test", {
      redirectTo: `${window.location.origin}/auth/callback?next=%2Fpasswort-neu`,
    });
  });

  test("zeigt bei einem Fehler einen ruhigen Text", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: null, error: { code: "over_email_send_rate_limit" } });
    render(<ForgotPasswordForm />);
    submit("a@example.test");
    expect(await screen.findByText(/Das hat gerade nicht geklappt/)).toBeTruthy();
  });
});

describe("Neues Passwort", () => {
  const submit = (password: string) => {
    fireEvent.change(screen.getByLabelText("Neues Passwort"), { target: { value: password } });
    fireEvent.click(screen.getByRole("button", { name: "Passwort speichern" }));
  };

  test("verlangt mindestens 6 Zeichen", async () => {
    render(<NewPasswordForm />);
    submit("12345");
    expect(await screen.findByText("Dein Passwort braucht mindestens 6 Zeichen.")).toBeTruthy();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  test("speichert das Passwort und geht zur Startseite", async () => {
    auth.updateUser.mockResolvedValue({ data: {}, error: null });
    render(<NewPasswordForm />);
    submit("neues-geheimnis");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "neues-geheimnis" });
  });

  test("meldet, wenn das neue Passwort dem alten gleicht", async () => {
    auth.updateUser.mockResolvedValue({ data: null, error: { code: "same_password" } });
    render(<NewPasswordForm />);
    submit("neues-geheimnis");
    expect(await screen.findByText(/anderes Passwort/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  test("Passwort anzeigen macht das Feld lesbar", () => {
    render(<NewPasswordForm />);
    const field = screen.getByLabelText("Neues Passwort") as HTMLInputElement;
    fireEvent.click(screen.getByLabelText("Passwort anzeigen"));
    expect(field.type).toBe("text");
  });
});
