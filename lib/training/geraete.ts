import { speichereProfil } from "../onboarding/speichern";
import type { createClient } from "../supabase/client";

// Geräte an einer Stelle (SIN-1271): Onboarding, Bibliothek, Plan und /konto/geraete nutzen dieselben Schlüssel.
// Schlüssel wie profiles.equipment laut SIN-1264.
export const GERAETE = {
  keine: "Nichts, nur ich",
  kurzhanteln: "Kurzhanteln",
  langhantel: "Langhantel",
  kabelzug: "Kabelzug",
  baender: "Bänder",
  kardio: "Kardiogerät",
  studio: "Fitnessstudio",
} as const;
export type Geraet = keyof typeof GERAETE;
export const KEINE: Geraet = "keine";

// Wie der Check profiles_weight_step_kg_range, unten enger: kleinste übliche Scheibe ist 0,25 kg.
export const STUFE_MIN = 0.25;
export const STUFE_MAX = 10;
export const STUFE_STANDARD = 2.5;

/** Nur bekannte Schlüssel, ohne Dopplungen, in fester Reihenfolge; „Nichts, nur ich“ schließt alle anderen aus. */
export function bereinigeGeraete(auswahl: readonly string[]): Geraet[] {
  if (auswahl.includes(KEINE)) return [KEINE];
  return (Object.keys(GERAETE) as Geraet[]).filter((g) => auswahl.includes(g));
}

export const istGueltigeStufe = (kg: number) => Number.isFinite(kg) && kg >= STUFE_MIN && kg <= STUFE_MAX;

type Client = ReturnType<typeof createClient>;

// Geräte gehören zu „Profil & Gewohnheiten“ (Einwilligung A); speichereProfil prüft das und meldet `keine_einwilligung`.
export async function speichereGeraete(client: Client, { geraete, stufeKg }: { geraete: readonly string[]; stufeKg: number }) {
  if (!istGueltigeStufe(stufeKg)) return { error: { code: "ungueltig" } };
  return speichereProfil(client, { equipment: bereinigeGeraete(geraete), weight_step_kg: stufeKg });
}
