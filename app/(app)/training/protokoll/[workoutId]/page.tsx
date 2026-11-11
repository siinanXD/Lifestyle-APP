import { notFound } from "next/navigation";
import { requireConsent } from "../../../../../lib/consent/require-consent";
import { createClient } from "../../../../../lib/supabase/server";
import { saetzeDesWorkouts } from "../../../../../lib/training/log";
import { ladePlantag, type Planposition } from "../../../../../lib/training/plan-ablauf";
import { Protokoll } from "./protokoll";

export const dynamic = "force-dynamic";

export default async function ProtokollPage({ params }: { params: Promise<{ workoutId: string }> }) {
  const { workoutId } = await params;
  await requireConsent("B", `/training/protokoll/${workoutId}`);
  const supabase = await createClient();
  const [workout, uebungen, profil, zuletzt, saetze] = await Promise.all([
    supabase.from("workouts").select("id, plan_id, plan_day_no").eq("id", workoutId).maybeSingle(),
    supabase.from("exercises").select("id, name, muscle_groups, technique").order("name"),
    supabase.from("profiles").select("weight_step_kg").maybeSingle(),
    supabase.from("workout_sets").select("exercise_id").order("created_at", { ascending: false }).limit(50),
    saetzeDesWorkouts(supabase as never, workoutId),
  ]);
  if (workout.error || uebungen.error || profil.error || zuletzt.error || !saetze.ok) throw new Error("Training konnte nicht geladen werden");
  // Fremde oder unbekannte Workouts sind per RLS unsichtbar und sehen wie „nicht vorhanden“ aus.
  if (!workout.data) notFound();
  // Zuletzt benutzte Übungen oben, danach alphabetisch.
  const rang = new Map<string, number>();
  for (const { exercise_id } of zuletzt.data) if (!rang.has(exercise_id)) rang.set(exercise_id, rang.size);
  const sortiert = [...uebungen.data].sort((a, b) => (rang.get(a.id) ?? Infinity) - (rang.get(b.id) ?? Infinity));
  // Training aus dem Plan (SIN-1285): die Übungen des Plantags als Vorgabe.
  let geplant: Planposition[] = [];
  const { plan_id, plan_day_no } = workout.data as { plan_id?: string | null; plan_day_no?: number | null };
  if (plan_id && plan_day_no) {
    const tag = await ladePlantag(supabase as never, plan_id, plan_day_no);
    if (!tag.ok) throw new Error("Training konnte nicht geladen werden");
    geplant = tag.daten;
  }
  return <Protokoll workoutId={workoutId} uebungen={sortiert} saetze={saetze.daten} geplant={geplant} stufeKg={Number((profil.data as { weight_step_kg?: number | null } | null)?.weight_step_kg ?? 2.5)} />;
}
