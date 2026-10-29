"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "../../lib/supabase/client";
import { Field } from "../auth-form";

const MIN_PASSWORD_LENGTH = 6; // wie minimum_password_length in supabase/config.toml

// Ziel des Reset-Links (nach /auth/callback, also mit Sitzung) und „Passwort ändern“ auf der Konto-Seite.
export function NewPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<{ password?: string; form?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError({ password: `Dein Passwort braucht mindestens ${MIN_PASSWORD_LENGTH} Zeichen.` });
    }
    setError({});
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setBusy(false);
      return setError({
        form:
          error.code === "same_password"
            ? "Bitte wähle ein anderes Passwort als bisher."
            : "Das hat gerade nicht geklappt. Bitte versuch es gleich noch einmal.",
      });
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "24rem", margin: "0 auto" }}>
      <h1>Neues Passwort</h1>
      <form method="post" onSubmit={onSubmit} noValidate style={{ display: "grid", gap: "1rem" }}>
        <Field
          name="password"
          label="Neues Passwort"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          error={error.password}
        />
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          Passwort anzeigen
        </label>
        {error.form && <p role="alert">{error.form}</p>}
        <button type="submit" disabled={busy} style={{ padding: "0.75rem", fontSize: "1rem" }}>
          Passwort speichern
        </button>
      </form>
    </main>
  );
}
