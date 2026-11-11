"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../../../../lib/supabase/client";
import { loescheWorkout } from "../../../../../lib/training/verlauf";

export function WorkoutLoeschen({ id }: { id: string }) {
  const router = useRouter();
  const [frage, setFrage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");

  async function loeschen() {
    setBusy(true);
    const r = await loescheWorkout(createClient(), id);
    if (!r.ok) {
      setBusy(false);
      return setFehler("Das hat gerade nicht geklappt. Das Training ist noch da.");
    }
    router.push("/training/verlauf");
    router.refresh();
  }

  if (!frage) {
    return (
      <button type="button" className="link-button" onClick={() => setFrage(true)}>
        Training löschen
      </button>
    );
  }
  return (
    <section className="card stack">
      <h2>Wirklich löschen?</h2>
      <p className="muted">Das Training und seine Sätze werden entfernt.</p>
      <div className="actions">
        <button type="button" className="btn" data-variant="danger" disabled={busy} onClick={loeschen}>
          Ja, löschen
        </button>
        <button type="button" className="btn" data-variant="neutral" disabled={busy} onClick={() => setFrage(false)}>
          Abbrechen
        </button>
      </div>
      {fehler && (
        <p role="alert" className="error">
          {fehler}
        </p>
      )}
    </section>
  );
}
