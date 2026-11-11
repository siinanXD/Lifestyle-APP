import Link from "next/link";
import { notFound } from "next/navigation";
import { requireConsent } from "../../../../../lib/consent/require-consent";
import { createClient } from "../../../../../lib/supabase/server";
import { saetzeDesWorkouts } from "../../../../../lib/training/log";
import { WorkoutLoeschen } from "./workout-loeschen";

export const dynamic = "force-dynamic";

type Workout = { id: string; started_at: string; ended_at: string | null; regeneration: "gut" | "schlecht" | null; note: string | null };
const zeit = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const kg = (wert: number) => `${Number(wert).toLocaleString("de-DE")} kg`;

export default async function VerlaufDetailPage({ params }: { params: Promise<{ workoutId: string }> }) {
  const { workoutId } = await params;
  await requireConsent("B", `/training/verlauf/${workoutId}`);
  const supabase = await createClient();
  const [workout, saetze] = await Promise.all([
    supabase.from("workouts").select("id, started_at, ended_at, regeneration, note").eq("id", workoutId).maybeSingle(),
    saetzeDesWorkouts(supabase as never, workoutId),
  ]);
  if (workout.error || !saetze.ok) throw new Error("Training konnte nicht geladen werden");
  // Fremde oder unbekannte Workouts sind per RLS unsichtbar und sehen wie „nicht vorhanden“ aus.
  if (!workout.data) notFound();
  const w = workout.data as Workout;
  // Sätze je Übung, in der Reihenfolge, in der die Übungen im Training vorkamen.
  const uebungen = new Map<string, { name: string; saetze: typeof saetze.daten }>();
  for (const s of saetze.daten) {
    const u = uebungen.get(s.exercise_id) ?? { name: s.exercises?.name ?? "Übung", saetze: [] };
    u.saetze.push(s);
    uebungen.set(s.exercise_id, u);
  }
  return (
    <main className="page stack" data-narrow>
      <p className="eyebrow">{w.ended_at ? "Training" : "Training (läuft)"}</p>
      <h1>{zeit(w.started_at)}</h1>
      {w.regeneration && <p className="muted">Gefühl danach: {w.regeneration === "gut" ? "gut" : "eher schlecht"}</p>}
      {w.note && <p>{w.note}</p>}
      {uebungen.size === 0 && <p className="muted">In diesem Training gibt es keine Sätze.</p>}
      {[...uebungen.entries()].map(([id, u]) => (
        <section key={id} className="card stack" aria-label={u.name}>
          <h2>{u.name}</h2>
          <ul className="summary">
            {[...u.saetze]
              .sort((a, b) => a.set_no - b.set_no)
              .map((s) => (
                <li key={s.set_no}>
                  {[`${s.reps} × ${s.weight_kg === null ? "Körpergewicht" : kg(s.weight_kg)}`, s.technique === "wackelig" && "wackelig", s.pain && "Schmerz"]
                    .filter(Boolean)
                    .join(" · ")}
                </li>
              ))}
          </ul>
        </section>
      ))}
      {!w.ended_at && (
        <Link href={`/training/protokoll/${w.id}`} className="btn">
          Weiter trainieren
        </Link>
      )}
      <WorkoutLoeschen id={w.id} />
      <Link href="/training/verlauf" className="link">
        Zum Verlauf
      </Link>
    </main>
  );
}
