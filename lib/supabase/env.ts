// NEXT_PUBLIC_*-Variablen müssen statisch gelesen werden, sonst setzt Next.js sie im Browser-Bundle nicht ein.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Umgebungsvariable NEXT_PUBLIC_SUPABASE_URL fehlt (siehe .env.example).");
  if (!anonKey) throw new Error("Umgebungsvariable NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt (siehe .env.example).");
  return { url, anonKey };
}

export const SUPABASE_SCHEMA = "lifestyle";
