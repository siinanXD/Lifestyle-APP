"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { callbackUrl, ensureProfile } from "../lib/auth/profile";
import { createClient } from "../lib/supabase/client";

const MIN_PASSWORD_LENGTH = 6; // wie minimum_password_length in supabase/config.toml

const COPY = {
  login: { title: "Willkommen zurück", button: "Anmelden", other: "/registrieren", otherText: "Noch kein Konto? Registrieren" },
  register: { title: "Schön, dass du da bist", button: "Registrieren", other: "/login", otherText: "Schon ein Konto? Anmelden" },
};

const LINK_SENT = "Wenn es zu dieser Adresse ein Konto gibt, haben wir dir einen Link geschickt. Er gilt kurz, schau auch im Spam-Ordner nach.";

function errorText(code: string | undefined) {
  if (code === "invalid_credentials") return "E-Mail oder Passwort stimmt nicht. Versuch es gern noch einmal.";
  if (code === "user_already_exists") return "Zu dieser E-Mail gibt es schon ein Konto. Melde dich gern an.";
  return "Das hat gerade nicht geklappt. Bitte versuch es gleich noch einmal.";
}

export function AuthForm({ mode, linkError }: { mode: "login" | "register"; linkError?: boolean }) {
  const router = useRouter();
  const copy = COPY[mode];
  const [errors, setErrors] = useState<{ email?: string; password?: string; consent?: string; form?: string }>(
    linkError ? { form: "Der Link ist abgelaufen oder wurde schon benutzt. Fordere gern einen neuen an." } : {},
  );
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    const next: typeof errors = {};
    if (!email) next.email = "Bitte gib deine E-Mail-Adresse ein.";
    if (!password) next.password = "Bitte gib dein Passwort ein.";
    else if (mode === "register" && password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Dein Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`;
    }
    if (mode === "register" && !form.get("consent")) next.consent = "Bitte stimme den Datenschutzhinweisen zu.";
    setErrors(next);
    setInfo("");
    if (next.email || next.password || next.consent) return;

    setBusy(true);
    const supabase = createClient();
    const { data, error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            // Die Site-URL des gemeinsamen Projekts gehört der Lernapp; ohne emailRedirectTo landet der Bestätigungslink dort.
            options: { emailRedirectTo: callbackUrl(), data: { lifestyle_privacy_consent_at: new Date().toISOString() } },
          });
    if (error) {
      setErrors({ form: errorText(error.code) });
      setBusy(false);
      return;
    }
    const session = "session" in data ? data.session : true;
    if (!data.user || !session) {
      // Ist die E-Mail-Bestätigung aktiv, gibt es erst nach dem Klick auf den Link eine Sitzung.
      setInfo("Fast geschafft: Bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben. Danach kannst du dich anmelden.");
      setBusy(false);
      return;
    }
    if ((await ensureProfile(supabase, data.user.id)).error) {
      setErrors({ form: errorText(undefined) });
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function sendMagicLink(event: React.MouseEvent<HTMLButtonElement>) {
    const email = String(new FormData(event.currentTarget.form!).get("email")).trim();
    setInfo("");
    if (!email) return setErrors({ email: "Bitte gib deine E-Mail-Adresse ein." });
    setErrors({});
    setBusy(true);
    // shouldCreateUser: false, damit neue Konten nur über „Registrieren“ (mit Datenschutz-Zustimmung) entstehen.
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl(), shouldCreateUser: false },
    });
    setBusy(false);
    // Kein Konto zu dieser Adresse sieht für die Person genauso aus wie ein verschickter Link.
    if (error && error.code !== "otp_disabled") return setErrors({ form: errorText(error.code) });
    setInfo(LINK_SENT);
  }

  async function signInWithGoogle() {
    setBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setErrors({ form: errorText(error.code) });
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "24rem", margin: "0 auto" }}>
      <h1>{copy.title}</h1>
      <form method="post" onSubmit={onSubmit} noValidate style={{ display: "grid", gap: "1rem" }}>
        <Field name="email" label="E-Mail" type="email" autoComplete="email" error={errors.email} />
        <Field
          name="password"
          label="Passwort"
          type={showPassword ? "text" : "password"}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          error={errors.password}
        />
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          Passwort anzeigen
        </label>
        {mode === "register" && (
          <div style={{ display: "grid", gap: "0.25rem" }}>
            <label style={{ display: "flex", gap: "0.5rem", alignItems: "start" }}>
              <input type="checkbox" name="consent" aria-describedby={errors.consent ? "consent-error" : undefined} />
              Ich habe die Datenschutzhinweise gelesen und stimme der Verarbeitung meiner Daten zu.
            </label>
            {errors.consent && (
              <span id="consent-error" role="alert">
                {errors.consent}
              </span>
            )}
          </div>
        )}
        {errors.form && <p role="alert">{errors.form}</p>}
        {info && <p role="status">{info}</p>}
        <button type="submit" disabled={busy} style={{ padding: "0.75rem", fontSize: "1rem" }}>
          {copy.button}
        </button>
        {mode === "login" && (
          <>
            <button type="button" disabled={busy} onClick={sendMagicLink} style={{ padding: "0.75rem", fontSize: "1rem" }}>
              Link per E-Mail schicken
            </button>
            <button type="button" disabled={busy} onClick={signInWithGoogle} style={{ padding: "0.75rem", fontSize: "1rem" }}>
              Mit Google anmelden
            </button>
          </>
        )}
      </form>
      {mode === "login" && (
        <p>
          <a href="/passwort-vergessen">Passwort vergessen?</a>
        </p>
      )}
      <p>
        <a href={copy.other}>{copy.otherText}</a>
      </p>
    </main>
  );
}

export function Field(props: { name: string; label: string; type: string; autoComplete: string; error?: string }) {
  const { name, label, error, ...input } = props;
  return (
    <div style={{ display: "grid", gap: "0.25rem" }}>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        style={{ padding: "0.75rem", fontSize: "1rem" }}
      />
      {error && (
        <span id={`${name}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
