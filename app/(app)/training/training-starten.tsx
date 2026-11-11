"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { starteWorkout } from "../../../lib/training/log";
import { starteWorkoutAusPlan } from "../../../lib/training/plan-ablauf";

// Mit `plan` startet das Training aus dem Plantag (SIN-1285), sonst frei.
export function TrainingStarten({ plan }: { plan?: { planId: string; tagNr: number } } = {}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState("");

  async function starten() {
    setBusy(true);
    const id = crypto.randomUUID();
    const r = plan ? await starteWorkoutAusPlan(createClient(), { id, ...plan }) : await starteWorkout(createClient(), { id });
    if (!r.ok) {
      setBusy(false);
      return setFehler("Das hat gerade nicht geklappt. Bitte versuch es gleich noch einmal.");
    }
    router.push(`/training/protokoll/${r.daten.id}`);
  }

  return (
    <>
      <button type="button" className="btn" data-variant={plan ? undefined : "neutral"} disabled={busy} onClick={starten}>
        {plan ? "Training starten" : "Freies Training starten"}
      </button>
      {fehler && (
        <p role="alert" className="error">
          {fehler}
        </p>
      )}
    </>
  );
}
