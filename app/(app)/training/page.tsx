import Link from "next/link";
import { requireConsent } from "../../../lib/consent/require-consent";
import { createClient } from "../../../lib/supabase/server";
import { letzteWorkouts } from "../../../lib/training/log";
import { ladeAktivenPlan, letzterPlantag, naechsterTag } from "../../../lib/training/plan-ablauf";
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
  const plan = await ladeAktivenPlan(supabase as never);
  if (!workouts.ok || !plan.ok) throw new Error("Trainings konnten nicht geladen werden");
  // „Heute dran“ (SIN-1285): der Plantag nach dem zuletzt trainierten, ohne Wochentagszwang.
  let heute: { tagNr: number; uebungen: string[] } | undefined;
  if (plan.daten) {
    const zuletzt = await letzterPlantag(supabase as never, plan.daten.id);
    if (!zuletzt.ok) throw new Error("Trainings konnten nicht geladen werden");
    const tagNr = naechsterTag(plan.daten.tage.map((t) => t.tagNr), zuletzt.daten);
    const tag = plan.daten.tage.find((t) => t.tagNr === tagNr);
    if (tag) heute = { tagNr: tag.tagNr, uebungen: tag.positionen.map((p) => p.name) };
  }
  return (
    <main className="page stack">
      <h1>Training</h1>
      {plan.daten && heute ? (
        <section className="card stack" aria-label="Heute dran">
          <p className="eyebrow">Heute dran</p>
          <h2>Tag {heute.tagNr}</h2>
          <p className="muted">{heute.uebungen.join(" · ")}</p>
          <TrainingStarten plan={{ planId: plan.daten.id, tagNr: heute.tagNr }} />
          <Link href="/training/plan" className="link">
            Plan ansehen
          </Link>
        </section>
      ) : (
        <Link href={plan.daten ? "/training/plan" : "/training/plan/neu"} className="link">
          {plan.daten ? "Plan ansehen" : "Plan erstellen"}
        </Link>
      )}
      <TrainingStarten />
      <Link href="/training/uebungen" className="link">
        Übungsbibliothek
      </Link>
      <Link href="/konto/geraete" className="link">
        Meine Geräte
      </Link>
      <Link href="/training/verlauf" className="link">
        Verlauf
      </Link>
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
