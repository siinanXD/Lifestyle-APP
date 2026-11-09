"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { starteWorkout } from "../../../lib/training/log";

export function TrainingStarten() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");

  async function starten() {
    setBusy(true);
    const r = await starteWorkout(createClient(), { id: crypto.randomUUID() });
    if (!r.ok) {
      setBusy(false);
      return setFehler("Das hat gerade nicht geklappt. Bitte versuch es gleich noch einmal.");
    }
    router.push(`/training/protokoll/${r.daten.id}`);
  }

  return (
    <>
      <button type="button" className="btn" disabled={busy} onClick={starten}>
        Freies Training starten
      </button>
      {fehler && (
        <p role="alert" className="error">
          {fehler}
        </p>
      )}
    </>
  );
}
