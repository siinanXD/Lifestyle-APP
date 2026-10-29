import type { createClient } from "../supabase/client";

// Eigene Zeile; RLS erlaubt nur id = auth.uid(). Existiert sie schon, passiert nichts.
// Ein Konto aus einer anderen App (gemeinsames Supabase-Auth) bekommt so beim ersten Login seine eigene Zeile.
export function ensureProfile(supabase: ReturnType<typeof createClient>, userId: string) {
  return supabase.from("profiles").upsert({ id: userId }, { onConflict: "id", ignoreDuplicates: true });
}

// Nur Pfade in der eigenen App; "//host" oder "/\host" wären offene Weiterleitungen.
export function safeNext(next: string | null) {
  return next?.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export function callbackUrl(next = "/") {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}
