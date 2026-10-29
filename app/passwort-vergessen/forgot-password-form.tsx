"use client";

import { useState, type FormEvent } from "react";
import { callbackUrl } from "../../lib/auth/profile";
import { createClient } from "../../lib/supabase/client";
import { Field } from "../auth-form";

export function ForgotPasswordForm() {
  const [error, setError] = useState<{ email?: string; form?: string }>({});
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    setInfo("");
    if (!email) return setError({ email: "Bitte gib deine E-Mail-Adresse ein." });
    setError({});
    setBusy(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl("/passwort-neu"),
    });
    setBusy(false);
    if (error) return setError({ form: "Das hat gerade nicht geklappt. Bitte versuch es gleich noch einmal." });
    // Gleiche Antwort, ob es ein Konto gibt oder nicht.
    setInfo("Wenn es zu dieser Adresse ein Konto gibt, haben wir dir einen Link geschickt. Er gilt kurz, schau auch im Spam-Ordner nach.");
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "24rem", margin: "0 auto" }}>
      <h1>Passwort vergessen?</h1>
      <p>Wir schicken dir einen Link, mit dem du ein neues Passwort wählst.</p>
      <form method="post" onSubmit={onSubmit} noValidate style={{ display: "grid", gap: "1rem" }}>
        <Field name="email" label="E-Mail" type="email" autoComplete="email" error={error.email} />
        {error.form && <p role="alert">{error.form}</p>}
        {info && <p role="status">{info}</p>}
        <button type="submit" disabled={busy} style={{ padding: "0.75rem", fontSize: "1rem" }}>
          Link schicken
        </button>
      </form>
      <p>
        <a href="/login">Zurück zur Anmeldung</a>
      </p>
    </main>
  );
}
