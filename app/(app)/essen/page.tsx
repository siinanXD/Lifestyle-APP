import { requireConsent } from "../../../lib/consent/require-consent";
import { ladebeginn, ladeMahlzeiten } from "../../../lib/essen/mahlzeiten";
import { createClient } from "../../../lib/supabase/server";
import { Mahlzeiten } from "./mahlzeiten";

// Mahlzeiten sind Gesundheitsdaten (Einwilligung B); Seite liest die Sitzung, nie vorab rendern.
export const dynamic = "force-dynamic";

export default async function EssenPage() {
  await requireConsent("B", "/essen");
  const supabase = await createClient();
  const r = await ladeMahlzeiten(supabase as never, ladebeginn());
  if (!r.ok) throw new Error("Mahlzeiten konnten nicht geladen werden");
  return <Mahlzeiten start={r.daten ?? []} />;
}
