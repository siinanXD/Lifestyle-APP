import type { createClient } from "../supabase/client";

type Client = ReturnType<typeof createClient>;

// Alle drei laufen im Browser mit der Sitzung der Person; RLS lässt nur die eigenen Zeilen zu.
async function nutzerId(supabase: Client) {
  const { data } = await supabase.auth.getUser();
  return data.user?.id;
}

// Die Profilzeile legt ensureProfile() beim Login an.
export async function speichereProfil(supabase: Client, felder: Record<string, unknown>) {
  const id = await nutzerId(supabase);
  if (!id) return { error: { code: "no_user" } };
  const { error } = await supabase.from("profiles").update(felder).eq("id", id);
  return { error };
}

// Nur nach Einwilligung B aufrufen (zuSpeichern liefert `gesundheit` sonst nicht).
export async function speichereGesundheit(supabase: Client, felder: Record<string, unknown>) {
  const id = await nutzerId(supabase);
  if (!id) return { error: { code: "no_user" } };
  const { error } = await supabase
    .from("health_profile")
    .upsert({ user_id: id, ...felder, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return { error };
}

// Nur nach Einwilligung B; eine Messung je Tag, ein zweiter Eintrag am selben Tag überschreibt sie.
export async function speichereKoerperwerte(supabase: Client, felder: { weight_kg: number }) {
  const id = await nutzerId(supabase);
  if (!id) return { error: { code: "no_user" } };
  const { error } = await supabase
    .from("body_measurements")
    .upsert({ user_id: id, ...felder }, { onConflict: "user_id,measured_on" });
  return { error };
}
