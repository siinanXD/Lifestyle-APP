"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "../lib/supabase/client";

const MIN_PASSWORD_LENGTH = 6; // wie minimum_password_length in supabase/config.toml

const COPY = {
  login: { title: "Willkommen zurück", button: "Anmelden", other: "/registrieren", otherText: "Noch kein Konto? Registrieren" },
  register: { title: "Schön, dass du da bist", button: "Registrieren", other: "/login", otherText: "Schon ein Konto? Anmelden" },
};

function errorText(code: string | undefined) {
  if (code === "invalid_credentials") return "E-Mail oder Passwort stimmt nicht. Versuch es gern noch einmal.";
  if (code === "user_already_exists") return "Zu dieser E-Mail gibt es schon ein Konto. Melde dich gern an.";
  return "Das hat gerade nicht geklappt. Bitte versuch es gleich noch einmal.";
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const copy = COPY[mode];
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

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
    setErrors(next);
    setInfo("");
    if (next.email || next.password) return;

    setBusy(true);
    const supabase = createClient();
    const { data, error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
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
    // Eigene Zeile; RLS erlaubt nur id = auth.uid(). Existiert sie schon, passiert nichts.
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: data.user.id }, { onConflict: "id", ignoreDuplicates: true });
    if (profileError) {
      setErrors({ form: errorText(undefined) });
      setBusy(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "24rem", margin: "0 auto" }}>
      <h1>{copy.title}</h1>
      <form method="post" onSubmit={onSubmit} noValidate style={{ display: "grid", gap: "1rem" }}>
        <Field name="email" label="E-Mail" type="email" autoComplete="email" error={errors.email} />
        <Field
          name="password"
          label="Passwort"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          error={errors.password}
        />
        {errors.form && <p role="alert">{errors.form}</p>}
        {info && <p role="status">{info}</p>}
        <button type="submit" disabled={busy} style={{ padding: "0.75rem", fontSize: "1rem" }}>
          {copy.button}
        </button>
      </form>
      <p>
        <a href={copy.other}>{copy.otherText}</a>
      </p>
    </main>
  );
}

function Field(props: { name: string; label: string; type: string; autoComplete: string; error?: string }) {
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
