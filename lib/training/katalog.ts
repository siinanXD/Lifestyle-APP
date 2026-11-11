// Übungsbibliothek (SIN-1268): reine Filterlogik, damit Seite und Tests dieselbe Regel nutzen.
export type Katalogeintrag = { id: string; name: string; category: string; muscle_groups: string[]; equipment: string[] };

export type Filter = {
  kategorie?: string;
  muskel?: string;
  geraete?: "ohne" | "meine";
  suche?: string;
  /** Aus profiles.equipment; leer oder fehlend = keine Einschränkung, „studio“ = alle Geräte (wie lib/training/plan.ts). */
  meineGeraete?: string[];
};

export const KATEGORIEN: Record<string, string> = {
  kraft: "Kraft",
  cardio: "Cardio",
  bodyweight: "Körpergewicht",
  mobility: "Mobilität",
  dehnen: "Dehnen",
};

const MUSKELN: Record<string, string> = {
  beine: "Beine",
  bizeps: "Bizeps",
  brust: "Brust",
  gesaess: "Gesäß",
  huefte: "Hüfte",
  ruecken: "Rücken",
  rumpf: "Rumpf",
  schulter: "Schulter",
  trizeps: "Trizeps",
};

const GERAETE: Record<string, string> = {
  kurzhanteln: "Kurzhanteln",
  langhantel: "Langhantel",
  kabelzug: "Kabelzug",
  baender: "Bänder",
  kardio: "Kardiogerät",
  flachbank: "Flachbank",
  kniebeugenstaender: "Kniebeugenständer",
};

export const kategorieText = (k: string) => KATEGORIEN[k] ?? k;
export const muskelText = (m: string) => MUSKELN[m] ?? m.charAt(0).toUpperCase() + m.slice(1);

export const geraetText = (g: string) => GERAETE[g] ?? g.charAt(0).toUpperCase() + g.slice(1);

/** Varianten einer Übung (SIN-1270): leichter = `variant_of` zeigt auf diese Übung, schwerer = diese zeigt auf die andere. */
export function varianten<T extends { slug: string; variant_of: string | null }>(uebung: { slug: string; variant_of: string | null }, alle: T[]) {
  return {
    leichter: alle.filter((u) => u.variant_of === uebung.slug),
    schwerer: alle.filter((u) => uebung.variant_of !== null && u.slug === uebung.variant_of),
  };
}

export function filtereUebungen<T extends Katalogeintrag>(liste: T[], filter: Filter): T[] {
  const suche = filter.suche?.trim().toLocaleLowerCase("de-DE");
  const meine = new Set(filter.meineGeraete ?? []);
  return liste.filter(
    (u) =>
      (!filter.kategorie || u.category === filter.kategorie) &&
      (!filter.muskel || u.muscle_groups.includes(filter.muskel)) &&
      (filter.geraete !== "ohne" || u.equipment.length === 0) &&
      (filter.geraete !== "meine" || meine.size === 0 || meine.has("studio") || u.equipment.every((g) => meine.has(g))) &&
      (!suche || u.name.toLocaleLowerCase("de-DE").includes(suche)),
  );
}

type Parameter = Record<string, string | string[] | undefined>;
const einzeln = (wert: string | string[] | undefined) => (typeof wert === "string" && wert.trim() ? wert.trim() : undefined);

/** URL-Parameter → Filter; Unbekanntes und Mehrfachwerte fallen weg. */
export function leseFilter(p: Parameter): Filter {
  const geraete = einzeln(p.geraete);
  const filter: Filter = {
    kategorie: einzeln(p.kategorie),
    muskel: einzeln(p.muskel),
    geraete: geraete === "ohne" || geraete === "meine" ? geraete : undefined,
    suche: einzeln(p.suche),
  };
  return Object.fromEntries(Object.entries(filter).filter(([, v]) => v !== undefined));
}

/** Link auf die Bibliothek mit geändertem Filter; feste Reihenfolge der Parameter. */
export function filterLink(filter: Filter, aenderung: Partial<Filter>) {
  const neu = { ...filter, ...aenderung };
  const p = new URLSearchParams();
  for (const k of ["kategorie", "muskel", "geraete", "suche"] as const) if (neu[k]) p.set(k, neu[k]);
  const q = p.toString();
  return q ? `/training/uebungen?${q}` : "/training/uebungen";
}

/** Eingabe für ilike: % und _ sind dort Platzhalter und werden maskiert. */
export const ilikeMuster = (suche: string) => `%${suche.replace(/[\\%_]/g, (z) => `\\${z}`)}%`;
