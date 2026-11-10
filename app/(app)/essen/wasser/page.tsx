import { requireConsent } from "../../../../lib/consent/require-consent";
import { ladebeginn, wasserSeit } from "../../../../lib/essen/wasser";
import { createClient } from "../../../../lib/supabase/server";
import { Wasser } from "./wasser";

// Wasser zählt als Gesundheitsdaten (Einwilligung B); Seite liest die Sitzung, nie vorab rendern.
export const dynamic = "force-dynamic";

export default async function WasserPage() {
  await requireConsent("B", "/essen/wasser");
  const supabase = await createClient();
  const r = await wasserSeit(supabase as never, ladebeginn());
  if (!r.ok) throw new Error("Wasser konnte nicht geladen werden");
  return <Wasser eintraege={r.daten} />;
}
