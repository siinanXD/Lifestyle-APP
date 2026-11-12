import { ladeGeraete, ladeVorrat } from "../../../lib/kochen/kueche";
import { createClient } from "../../../lib/supabase/server";
import { Rezeptvorschlaege } from "./rezeptvorschlaege";

// Rezeptvorschläge aus Vorrat und Geräten der angemeldeten Person (SIN-1626); nie vorab rendern.
export const dynamic = "force-dynamic";

export default async function KochenPage() {
  const supabase = await createClient();
  const [vorrat, geraete] = await Promise.all([ladeVorrat(supabase as never), ladeGeraete(supabase as never)]);
  // Lesefehler nicht als „nichts da“ zeigen: Sonst sähe es aus, als fehle für jedes Rezept alles.
  if (!vorrat.ok || !geraete.ok) throw new Error("Vorrat und Geräte konnten nicht geladen werden");
  return (
    <Rezeptvorschlaege
      vorrat={(vorrat.daten ?? []).flatMap((z) => (z.ingredient_key ? [z.ingredient_key] : []))}
      geraete={(geraete.daten ?? []).map((g) => g.kind)}
    />
  );
}
