import { requireConsent } from "../../../../lib/consent/require-consent";
import { createClient } from "../../../../lib/supabase/server";
import { AktivitaetFormular } from "./aktivitaet-formular";

// Aktivitäten sind Gesundheitsdaten (Einwilligung B); Seite liest die Sitzung, nie vorab rendern.
export const dynamic = "force-dynamic";

export default async function AktivitaetPage() {
  await requireConsent("B", "/training/aktivitaet");
  const supabase = await createClient();
  // Schnellwahl: Katalog-Übungen der Kategorien ohne Sätze.
  const { data, error } = await supabase.from("exercises").select("name, category").in("category", ["cardio", "mobility", "dehnen"]).order("name");
  if (error) throw new Error("Übungen konnten nicht geladen werden");
  return <AktivitaetFormular vorschlaege={(data ?? []) as { name: string; category: string }[]} />;
}
