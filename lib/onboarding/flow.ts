import { EINSCHRAENKUNGEN, ERFAHRUNG, GERAETE, MINUTEN, NICHT_ANGEGEBEN, ZIELE } from "./texte";

export type Schritt =
  | "willkommen"
  | "ziele"
  | "zeit"
  | "erfahrung"
  | "einschraenkungen"
  | "geraete"
  | "freiwillig"
  | "zusammenfassung";
export type Ziel = Schritt | "start";
export type TeilFreiwillig = "koerperwerte" | "gewohnheiten" | "coach";

// true = erteilt, false = abgelehnt, fehlt = noch nicht gefragt. Gefragt wird im Schritt selbst (A in Schritt 0, B in 4 und 6, E in 6),
// deshalb bleibt ein Schritt sichtbar, solange seine Einwilligung offen ist. Gespeichert wird nur bei true.
export type Einwilligungen = Partial<Record<"A" | "B" | "E", boolean>>;

export type Antworten = {
  ziele?: (keyof typeof ZIELE)[];
  zielNotiz?: string;
  tageProWoche?: number;
  minutenProEinheit?: (typeof MINUTEN)[number];
  erfahrung?: keyof typeof ERFAHRUNG;
  einschraenkungen?: (keyof typeof EINSCHRAENKUNGEN)[];
  einschraenkungNotiz?: string;
  geraete?: (keyof typeof GERAETE)[];
  gewichtKg?: number;
  groesseCm?: number;
  gewohnheiten?: boolean;
  coach?: boolean;
};

// Spaltennamen wie lifestyle.profiles (SIN-1257), lifestyle.health_profile (SIN-1258), lifestyle.body_measurements (SIN-1259).
export type ZuSpeichern = {
  profil?: Partial<{
    goals: string[];
    goal_note: string | null;
    days_per_week: number;
    minutes_per_session: number;
    experience: string;
    equipment: string[];
  }>;
  gesundheit?: Partial<{ restrictions: string[]; restriction_note: string | null; height_cm: number }>;
  koerperwerte?: { weight_kg: number };
  coach?: boolean;
};

const nichtAbgelehnt = (wert: boolean | undefined) => wert !== false;

export function teileFreiwillig(e: Einwilligungen): TeilFreiwillig[] {
  if (!nichtAbgelehnt(e.A)) return [];
  const teile: TeilFreiwillig[] = [];
  if (nichtAbgelehnt(e.B)) teile.push("koerperwerte");
  teile.push("gewohnheiten");
  if (nichtAbgelehnt(e.E)) teile.push("coach");
  return teile;
}

/** Schritte in Reihenfolge laut docs/ONBOARDING.md; ohne A entfällt alles bis auf Willkommen und Zusammenfassung. */
export function schritte(e: Einwilligungen): Schritt[] {
  if (!nichtAbgelehnt(e.A)) return ["willkommen", "zusammenfassung"];
  return [
    "willkommen",
    "ziele",
    "zeit",
    "erfahrung",
    ...(nichtAbgelehnt(e.B) ? (["einschraenkungen"] as const) : []),
    "geraete",
    ...(teileFreiwillig(e).length > 0 ? (["freiwillig"] as const) : []),
    "zusammenfassung",
  ];
}

const REIHENFOLGE = schritte({});

// Liegt `schritt` nicht (mehr) in der Liste, zählt seine Position in der vollen Reihenfolge.
function nachbar(schritt: Schritt, e: Einwilligungen, richtung: 1 | -1): Schritt | undefined {
  const liste = schritte(e);
  const pos = REIHENFOLGE.indexOf(schritt);
  const kandidaten = richtung === 1 ? liste.filter((s) => REIHENFOLGE.indexOf(s) > pos) : liste.filter((s) => REIHENFOLGE.indexOf(s) < pos);
  return richtung === 1 ? kandidaten[0] : kandidaten.at(-1);
}

export function naechster(schritt: Schritt, e: Einwilligungen): Ziel {
  return nachbar(schritt, e, 1) ?? "start";
}

export function vorheriger(schritt: Schritt, e: Einwilligungen): Schritt {
  return nachbar(schritt, e, -1) ?? "willkommen";
}

export function allesUeberspringen(): Ziel {
  return "start";
}

const leer = (wert: unknown) =>
  wert === undefined || (typeof wert === "string" && wert.trim() === "") || (Array.isArray(wert) && wert.length === 0);

const notiz = (text: string | undefined) => (text === undefined ? undefined : text.trim() || null);

// Leer löscht nur, was wirklich gespeichert ist; sonst entstünden eine leere Zeile und Einwilligung B ohne Inhalt.
function ohneLeereNeue(a: Antworten, gespeichert: Antworten): Antworten {
  return Object.fromEntries(Object.entries(a).filter(([f, v]) => !leer(v) || !leer(gespeichert[f as keyof Antworten])));
}

// undefined heißt unbeantwortet und fehlt in den Daten; eine geleerte Auswahl oder Notiz ist eine Änderung und wird gespeichert.
function ohneFehlende<T extends Record<string, unknown>>(obj: T): Partial<T> | undefined {
  const gefiltert = Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
  return Object.keys(gefiltert).length > 0 ? gefiltert : undefined;
}

/** Datenminimierung: was gespeichert werden darf. Ohne A nichts, ohne B keine Gesundheitsangaben, ohne E kein Coach. */
export function zuSpeichern(antworten: Antworten, e: Einwilligungen, gespeichert: Antworten = {}): ZuSpeichern {
  if (e.A !== true) return {};
  const a = ohneLeereNeue(antworten, gespeichert);
  const daten: ZuSpeichern = {};
  const profil = ohneFehlende({
    goals: a.ziele,
    goal_note: notiz(a.zielNotiz),
    days_per_week: a.tageProWoche,
    minutes_per_session: a.minutenProEinheit,
    experience: a.erfahrung,
    equipment: a.geraete,
  });
  if (profil) daten.profil = profil;
  if (e.B === true) {
    const gesundheit = ohneFehlende({
      restrictions: a.einschraenkungen,
      restriction_note: notiz(a.einschraenkungNotiz),
      height_cm: a.groesseCm,
    });
    if (gesundheit) daten.gesundheit = gesundheit;
    if (a.gewichtKg !== undefined) daten.koerperwerte = { weight_kg: a.gewichtKg };
  }
  if (e.E === true && a.coach !== undefined) daten.coach = a.coach;
  return daten;
}

const liste = <K extends string>(werte: K[] | undefined, texte: Record<K, string>) =>
  leer(werte) ? NICHT_ANGEGEBEN : werte!.map((w) => texte[w]).join(", ");

function zeit(a: Antworten) {
  const teile = [
    a.tageProWoche !== undefined ? `${a.tageProWoche} ${a.tageProWoche === 1 ? "Tag" : "Tage"}` : undefined,
    a.minutenProEinheit !== undefined ? `${a.minutenProEinheit} Min` : undefined,
  ].filter(Boolean);
  return teile.length > 0 ? teile.join(" · ") : NICHT_ANGEGEBEN;
}

/** Zeilen der Zusammenfassung; Übersprungenes steht als „nicht angegeben“. */
export function zusammenfassung(a: Antworten): { label: string; wert: string }[] {
  return [
    { label: "Ziel", wert: liste(a.ziele, ZIELE) },
    { label: "Zeit", wert: zeit(a) },
    { label: "Erfahrung", wert: a.erfahrung ? ERFAHRUNG[a.erfahrung] : NICHT_ANGEGEBEN },
    { label: "Geräte", wert: liste(a.geraete, GERAETE) },
    { label: "Rücksicht", wert: liste(a.einschraenkungen, EINSCHRAENKUNGEN) },
  ];
}
