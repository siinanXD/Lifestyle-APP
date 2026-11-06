import { hatEinwilligung } from "../../lib/consent/consent";
import type { Antworten } from "../../lib/onboarding/flow";
import { createClient } from "../../lib/supabase/server";
import { Onboarding } from "./onboarding";

// Liest Profil und Einwilligung der angemeldeten Person; nie vorab rendern.
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const [profil, einwilligungen] = await Promise.all([
    supabase.from("profiles").select("adult_confirmed_at, goals, goal_note, days_per_week, minutes_per_session, experience").maybeSingle(),
    supabase.from("consents").select("kind, revoked_at").eq("kind", "A"),
  ]);
  // Lesefehler nicht als „leeres Profil“ zeigen, sonst würde die Person ihre Angaben überschreiben.
  if (profil.error || einwilligungen.error) throw new Error("Profil konnte nicht geladen werden");
  const p = profil.data;
  const antworten: Antworten = {
    ziele: p?.goals?.length ? p.goals : undefined,
    zielNotiz: p?.goal_note ?? undefined,
    tageProWoche: p?.days_per_week ?? undefined,
    minutenProEinheit: p?.minutes_per_session ?? undefined,
    erfahrung: p?.experience ?? undefined,
  };
  return <Onboarding start={{ volljaehrig: Boolean(p?.adult_confirmed_at), einwilligungA: hatEinwilligung(einwilligungen.data, "A"), antworten }} />;
}
