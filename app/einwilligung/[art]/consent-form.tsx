"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { erteileEinwilligung } from "../../../lib/consent/consent";
import { EINWILLIGUNGSTEXTE, type Art } from "../../../lib/consent/texte";
import { safeNext } from "../../../lib/auth/profile";
import { createClient } from "../../../lib/supabase/client";

export function ConsentForm({ art, next }: { art: Art; next: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false); // nie vorangekreuzt
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checked) return setError("Bitte setze zuerst den Haken, wenn du zustimmen möchtest.");
    setError("");
    setBusy(true);
    const { error } = await erteileEinwilligung(createClient(), art);
    if (error) {
      setBusy(false);
      return setError("Das hat gerade nicht geklappt. Deine Zustimmung ist nicht gespeichert. Bitte versuch es gleich noch einmal.");
    }
    router.push(safeNext(next));
    router.refresh();
  }

  return (
    <form method="post" onSubmit={onSubmit} noValidate style={{ display: "grid", gap: "1rem" }}>
      <p>{EINWILLIGUNGSTEXTE[art].text}</p>
      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        Ich stimme zu.
      </label>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy} style={{ padding: "0.75rem", fontSize: "1rem" }}>
        Zustimmen
      </button>
      <button type="button" disabled={busy} onClick={() => router.push("/")} style={{ padding: "0.75rem", fontSize: "1rem" }}>
        Nicht jetzt
      </button>
    </form>
  );
}
