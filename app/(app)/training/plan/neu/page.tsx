import { createClient } from "../../../../../lib/supabase/server";
import { erstellePlan } from "../../../../../lib/training/plan";
import { ladePlanEingabe } from "../../../../../lib/training/plan-eingabe";
import { PlanVorschlag } from "./plan-vorschlag";

// Liest Profil und Einwilligung der angemeldeten Person; nie vorab rendern.
// Pläne brauchen keine Einwilligung B (Migration SIN-1282); Gesundheitsangaben fließen nur mit B ein.
export const dynamic = "force-dynamic";

export default async function PlanNeuPage() {
  const supabase = await createClient();
  // Server- und Browser-Client haben dieselbe Abfrage-API; plan-eingabe.ts ist auf den Browser-Typ geschrieben.
  const eingabe = await ladePlanEingabe(supabase as never);
  if (!eingabe.ok) throw new Error("Plan-Angaben konnten nicht geladen werden");
  const { angaben, katalog, ohneBeschwerden } = eingabe.daten;
  return <PlanVorschlag plan={erstellePlan(angaben, katalog)} ohneBeschwerden={ohneBeschwerden} />;
}
