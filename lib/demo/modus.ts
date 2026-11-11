// Demo-Modus (SIN-1623): App ohne Login und ohne Supabase durchklicken, Daten nur im Arbeitsspeicher.
// NEXT_PUBLIC_*-Variablen müssen statisch gelesen werden, sonst setzt Next.js sie im Browser-Bundle nicht ein.
// In Produktion nie aktiv: Der Server prüft VERCEL_ENV, und next.config.ts bricht einen Produktions-Build mit Schalter ab.
export function istDemo() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "on" && process.env.VERCEL_ENV !== "production";
}

export const DEMO_NUTZER = { id: "00000000-0000-4000-8000-000000000001", email: "demo@example.com" };
export const DEMO_HINWEIS = "Demo-Modus: Beispieldaten, nichts wird dauerhaft gespeichert. Bitte keine echten Daten eintragen.";
