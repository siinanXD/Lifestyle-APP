import { ladeVorrat } from "../../../../lib/kochen/kueche";
import { createClient } from "../../../../lib/supabase/server";
import { Vorrat } from "./vorrat";

// Liest den Vorrat der angemeldeten Person; nie vorab rendern.
export const dynamic = "force-dynamic";

export default async function VorratPage() {
  const supabase = await createClient();
  const r = await ladeVorrat(supabase as never);
  if (!r.ok) throw new Error("Vorrat konnte nicht geladen werden");
  return <Vorrat start={r.daten ?? []} />;
}
