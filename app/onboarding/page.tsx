import { hatEinwilligung } from "../../lib/consent/consent";
import type { Antworten } from "../../lib/onboarding/flow";
import { createClient } from "../../lib/supabase/server";
import { Onboarding } from "./onboarding";

const leerZuUndefined = <T,>(liste: T[] | null | undefined) => (liste?.length ? liste : undefined);

// Liest Profil und Einwilligung der angemeldeten Person; nie vorab rendern.
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const [profil, einwilligungen, gesundheit] = await Promise.all([
    supabase
      .from("profiles")
      .select("adult_confirmed_at, goals, goal_note, days_per_week, minutes_per_session, experience, equipment")
      .maybeSingle(),
    supabase.from("consents").select("kind, revoked_at").in("kind", ["A", "B"]),
    supabase.from("health_profile").select("restrictions, restriction_note, height_cm").maybeSingle(),
  ]);
  // Lesefehler nicht als „leeres Profil“ zeigen, sonst würde die Person ihre Angaben überschreiben.
  if (profil.error || einwilligungen.error || gesundheit.error) throw new Error("Profil konnte nicht geladen werden");
  const p = profil.data;
  const g = gesundheit.data;
  const antworten: Antworten = {
    ziele: leerZuUndefined(p?.goals),
    zielNotiz: p?.goal_note ?? undefined,
    tageProWoche: p?.days_per_week ?? undefined,
    minutenProEinheit: p?.minutes_per_session ?? undefined,
    erfahrung: p?.experience ?? undefined,
    geraete: leerZuUndefined(p?.equipment),
    einschraenkungen: leerZuUndefined(g?.restrictions),
    einschraenkungNotiz: g?.restriction_note ?? undefined,
    groesseCm: g?.height_cm ?? undefined,
  };
  return (
    <Onboarding
      start={{
        volljaehrig: Boolean(p?.adult_confirmed_at),
        einwilligungA: hatEinwilligung(einwilligungen.data, "A"),
        einwilligungB: hatEinwilligung(einwilligungen.data, "B"),
        antworten,
      }}
    />
  );
}
