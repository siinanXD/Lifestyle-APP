import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AuthForm } from "../../app/auth-form";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}));
const insert = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    auth,
    from: () => ({ upsert: insert }),
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));

const user = { id: "u1" };

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Passwort"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /^(Anmelden|Registrieren)$/ }));
}

beforeEach(() => insert.mockResolvedValue({ error: null }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AuthForm login", () => {
  test("zeigt Fehlertexte bei leeren Feldern und ruft Supabase nicht auf", async () => {
    render(<AuthForm mode="login" />);
    fill("", "");
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
    expect(screen.getByText("Bitte gib deine E-Mail-Adresse ein.")).toBeTruthy();
    expect(screen.getByText("Bitte gib dein Passwort ein.")).toBeTruthy();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  test("zeigt einen ruhigen Text bei Supabase-Fehler", async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: "invalid_credentials", message: "Invalid login credentials" },
    });
    render(<AuthForm mode="login" />);
    fill("a@example.test", "geheim123");
    expect(await screen.findByText(/E-Mail oder Passwort stimmt nicht/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  test("legt beim Login das eigene Profil an und geht zur Startseite", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: { user }, error: null });
    render(<AuthForm mode="login" />);
    fill("a@example.test", "geheim123");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(insert).toHaveBeenCalledWith({ id: "u1" }, { onConflict: "id", ignoreDuplicates: true });
  });
});

describe("AuthForm registrieren", () => {
  test("verlangt mindestens 6 Zeichen im Passwort", async () => {
    render(<AuthForm mode="register" />);
    fill("a@example.test", "12345");
    expect(await screen.findByText("Dein Passwort braucht mindestens 6 Zeichen.")).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  test("zeigt einen ruhigen Text bei Supabase-Fehler", async () => {
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "over_request_rate_limit", message: "rate limit" },
    });
    render(<AuthForm mode="register" />);
    fill("a@example.test", "geheim123");
    expect(await screen.findByText(/Das hat gerade nicht geklappt/)).toBeTruthy();
  });

  test("legt mit Sitzung das Profil an und geht zur Startseite", async () => {
    auth.signUp.mockResolvedValue({ data: { user, session: {} }, error: null });
    render(<AuthForm mode="register" />);
    fill("a@example.test", "geheim123");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(insert).toHaveBeenCalledOnce();
  });

  test("ohne Sitzung (E-Mail-Bestätigung nötig) bleibt auf der Seite und erklärt es", async () => {
    auth.signUp.mockResolvedValue({ data: { user, session: null }, error: null });
    render(<AuthForm mode="register" />);
    fill("a@example.test", "geheim123");
    expect(await screen.findByText(/Bestätige/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});
