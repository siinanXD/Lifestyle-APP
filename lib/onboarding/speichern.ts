import type { createClient } from "../supabase/client";

type Client = ReturnType<typeof createClient>;

// Läuft im Browser mit der Sitzung der Person; RLS lässt nur die eigene Zeile zu. Die Zeile legt ensureProfile() beim Login an.
export async function speichereProfil(supabase: Client, felder: Record<string, unknown>) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: { code: "no_user" } };
  const { error } = await supabase.from("profiles").update(felder).eq("id", data.user.id);
  return { error };
}
