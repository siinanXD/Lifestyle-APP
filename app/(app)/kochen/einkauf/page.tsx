import { ladeEinkauf } from "../../../../lib/kochen/einkauf";
import { createClient } from "../../../../lib/supabase/server";
import { Einkaufsliste } from "./einkaufsliste";

// Liest die Einkaufsliste der angemeldeten Person; nie vorab rendern.
export const dynamic = "force-dynamic";

export default async function EinkaufPage() {
  const supabase = await createClient();
  const r = await ladeEinkauf(supabase as never);
  if (!r.ok) throw new Error("Einkaufsliste konnte nicht geladen werden");
  return <Einkaufsliste start={r.daten ?? []} />;
}
