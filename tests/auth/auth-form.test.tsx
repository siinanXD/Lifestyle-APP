import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AuthForm } from "../../app/auth-form";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
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
const callback = (next = "/") => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

function fill(email: string, password: string, consentGiven = true) {
  fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Passwort"), { target: { value: password } });
  if (consentGiven && screen.queryByLabelText(/Datenschutz/)) fireEvent.click(screen.getByLabelText(/Datenschutz/));
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

describe("AuthForm Standard-Anmeldung (SIN-1198)", () => {
  test("Passwort anzeigen macht das Feld lesbar und wieder unsichtbar", () => {
    render(<AuthForm mode="login" />);
    const field = screen.getByLabelText("Passwort") as HTMLInputElement;
    expect(field.type).toBe("password");
    fireEvent.click(screen.getByLabelText("Passwort anzeigen"));
    expect(field.type).toBe("text");
    fireEvent.click(screen.getByLabelText("Passwort anzeigen"));
    expect(field.type).toBe("password");
  });

  test("Login verlinkt „Passwort vergessen?“", () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByRole("link", { name: "Passwort vergessen?" }).getAttribute("href")).toBe("/passwort-vergessen");
  });

  test("Registrieren zeigt weder „Passwort vergessen?“ noch Magic-Link noch Google", () => {
    render(<AuthForm mode="register" />);
    expect(screen.queryByText("Passwort vergessen?")).toBeNull();
    expect(screen.queryByRole("button", { name: "Link per E-Mail schicken" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mit Google anmelden" })).toBeNull();
  });

  test("Registrieren ohne Zustimmung zum Datenschutz ruft Supabase nicht auf", async () => {
    render(<AuthForm mode="register" />);
    fill("a@example.test", "geheim123", false);
    expect(await screen.findByText("Bitte stimme den Datenschutzhinweisen zu.")).toBeTruthy();
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  test("signUp übergibt emailRedirectTo mit der eigenen Origin und die Zustimmung", async () => {
    auth.signUp.mockResolvedValue({ data: { user, session: null }, error: null });
    render(<AuthForm mode="register" />);
    fill("a@example.test", "geheim123");
    await screen.findByText(/Bestätige/);
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "a@example.test",
      password: "geheim123",
      options: { emailRedirectTo: callback(), data: { lifestyle_privacy_consent_at: expect.any(String) } },
    });
  });

  test("Magic-Link legt kein neues Konto an und übergibt emailRedirectTo", async () => {
    auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "a@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Link per E-Mail schicken" }));
    expect(await screen.findByText(/Wenn es zu dieser Adresse ein Konto gibt/)).toBeTruthy();
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "a@example.test",
      options: { emailRedirectTo: callback(), shouldCreateUser: false },
    });
  });

  test("Magic-Link verrät nicht, ob es die Adresse gibt", async () => {
    auth.signInWithOtp.mockResolvedValue({ data: {}, error: { code: "otp_disabled", message: "Signups not allowed for otp" } });
    render(<AuthForm mode="login" />);
    fireEvent.change(screen.getByLabelText("E-Mail"), { target: { value: "neu@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Link per E-Mail schicken" }));
    expect(await screen.findByText(/Wenn es zu dieser Adresse ein Konto gibt/)).toBeTruthy();
  });

  test("Magic-Link verlangt eine E-Mail-Adresse", async () => {
    render(<AuthForm mode="login" />);
    fireEvent.click(screen.getByRole("button", { name: "Link per E-Mail schicken" }));
    expect(await screen.findByText("Bitte gib deine E-Mail-Adresse ein.")).toBeTruthy();
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  test("Google startet OAuth mit redirectTo auf die eigene Origin", async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
    render(<AuthForm mode="login" />);
    fireEvent.click(screen.getByRole("button", { name: "Mit Google anmelden" }));
    await waitFor(() =>
      expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: callback() } }),
    );
  });

  test("zeigt einen ruhigen Text, wenn ein Mail-Link ungültig war", () => {
    render(<AuthForm mode="login" linkError />);
    expect(screen.getByRole("alert").textContent).toMatch(/Link ist abgelaufen/);
  });
});
