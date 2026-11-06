import Link from "next/link";
import { requireConsent } from "../../../lib/consent/require-consent";
import { createClient } from "../../../lib/supabase/server";
import { letzteWorkouts } from "../../../lib/training/log";
import { TrainingStarten } from "./training-starten";

// Trainingsdaten sind Gesundheitsdaten (Einwilligung B); Seite liest die Sitzung, nie vorab rendern.
export const dynamic = "force-dynamic";

const datum = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function TrainingPage() {
  await requireConsent("B", "/training");
  const supabase = await createClient();
  // Server- und Browser-Client haben dieselbe Abfrage-API; log.ts ist auf den Browser-Typ geschrieben.
  const workouts = await letzteWorkouts(supabase as never, 5);
  if (!workouts.ok) throw new Error("Trainings konnten nicht geladen werden");
  return (
    <main className="page stack">
      <h1>Training</h1>
      <TrainingStarten />
      <section className="stack">
        <h2>Letzte Trainings</h2>
        {workouts.daten.length === 0 ? (
          <p className="muted">Noch keine Trainings.</p>
        ) : (
          <ul className="summary">
            {workouts.daten.map((w) => (
              <li key={w.id}>
                <Link href={`/training/protokoll/${w.id}`} className="link">
                  {datum(w.started_at)}
                  {w.ended_at ? "" : " (läuft)"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
