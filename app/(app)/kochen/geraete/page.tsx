import { ladeGeraete } from "../../../../lib/kochen/kueche";
import { createClient } from "../../../../lib/supabase/server";
import { Kuechengeraete } from "./kuechengeraete";

// Liest die Geräte der angemeldeten Person; nie vorab rendern.
export const dynamic = "force-dynamic";

export default async function KuechengeraetePage() {
  const supabase = await createClient();
  const r = await ladeGeraete(supabase as never);
  // Lesefehler nicht als „keine Geräte“ zeigen.
  if (!r.ok) throw new Error("Küchengeräte konnten nicht geladen werden");
  return <Kuechengeraete start={r.daten ?? []} />;
}
