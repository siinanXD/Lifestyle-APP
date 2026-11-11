import { requireConsent } from "../../../../lib/consent/require-consent";
import { createClient } from "../../../../lib/supabase/server";
import { ladeVerlauf } from "../../../../lib/training/verlauf";
import { Verlauf } from "./verlauf";

// Trainingsdaten sind Gesundheitsdaten (Einwilligung B); Seite liest die Sitzung, nie vorab rendern.
export const dynamic = "force-dynamic";

export default async function VerlaufPage() {
  await requireConsent("B", "/training/verlauf");
  const supabase = await createClient();
  const r = await ladeVerlauf(supabase as never);
  if (!r.ok) throw new Error("Verlauf konnte nicht geladen werden");
  return <Verlauf start={r.daten} />;
}
