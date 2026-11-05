import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import { hatEinwilligung } from "./consent";
import type { Art } from "./texte";

// Am Anfang einer Server Component aufrufen, die Daten der Art `art` braucht.
// `next` ist die aktuelle Seite; dorthin kehrt die Person nach dem Zustimmen zurück.
export async function requireConsent(art: Art, next = "/") {
  const supabase = await createClient();
  const { data, error } = await supabase.from("consents").select("kind, revoked_at").eq("kind", art);
  // Bei einem Lesefehler nicht durchlassen, aber auch nicht auf die Zustimmung schicken: Es fehlt nichts, es klemmt.
  if (error) throw new Error("Einwilligung konnte nicht geprüft werden");
  if (!hatEinwilligung(data, art)) redirect(`/einwilligung/${art}?next=${encodeURIComponent(next)}`);
}
