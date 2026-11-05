import type { createClient } from "../supabase/client";
import { EINWILLIGUNGSTEXTE, type Art } from "./texte";

type Client = ReturnType<typeof createClient>;

export type Einwilligungszeile = { kind: string; revoked_at: string | null };

// Offen = nicht widerrufen. Mehrere Zeilen je Art sind normal (Erteilen, Widerrufen, wieder Erteilen).
export function hatEinwilligung(zeilen: Einwilligungszeile[], art: Art) {
  return zeilen.some((z) => z.kind === art && z.revoked_at === null);
}

// Läuft im Browser mit der Sitzung der Person; RLS lässt nur user_id = auth.uid() zu.
export async function erteileEinwilligung(supabase: Client, art: Art) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: { code: "no_user" } };
  const { error } = await supabase
    .from("consents")
    .insert({ user_id: data.user.id, kind: art, text_version: EINWILLIGUNGSTEXTE[art].version });
  // 23505: Es gibt schon eine offene Einwilligung dieser Art (z. B. Doppelklick) – das Ziel ist erreicht.
  return { error: error?.code === "23505" ? null : error };
}

// Setzt nur den Widerruf; die Zeile bleibt als Nachweis stehen (kein delete erlaubt).
export function widerrufeEinwilligung(supabase: Client, art: Art) {
  return supabase
    .from("consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("kind", art)
    .is("revoked_at", null);
}
