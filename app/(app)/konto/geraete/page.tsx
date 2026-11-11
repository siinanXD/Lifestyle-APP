import { createClient } from "../../../../lib/supabase/server";
import { STUFE_STANDARD } from "../../../../lib/training/geraete";
import { GeraeteFormular } from "./geraete-formular";

// Liest das Profil der angemeldeten Person; nie vorab rendern.
export const dynamic = "force-dynamic";

export default async function GeraetePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("equipment, weight_step_kg").maybeSingle();
  // Lesefehler nicht als „keine Geräte“ zeigen, sonst würde die Person ihre Angaben überschreiben.
  if (error) throw new Error("Geräte konnten nicht geladen werden");
  const p = data as { equipment: string[] | null; weight_step_kg: number | null } | null;
  return <GeraeteFormular geraete={p?.equipment ?? []} stufeKg={Number(p?.weight_step_kg ?? STUFE_STANDARD)} />;
}
