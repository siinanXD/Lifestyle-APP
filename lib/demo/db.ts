import { EINWILLIGUNGSTEXTE } from "../consent/texte";
import { DEMO_NUTZER } from "./modus";

// Kleiner Ersatz für PostgREST im Demo-Modus (SIN-1623): führt die aufgezeichnete Kette eines Supabase-Aufrufs gegen Listen im Speicher aus.
// Deckt nur ab, was die App nutzt. Keine RLS, keine Einwilligungs-Prüfung: Es gibt genau einen Demo-Nutzer und keine echten Daten.
export type Op = { m: string; a: unknown[] };
export type Antwort = { data: unknown; error: { code: string; message: string } | null };
type Zeile = Record<string, unknown>;
type Speicher = Record<string, Zeile[]>;

const jetzt = () => new Date().toISOString();
const uebung = (slug: string, name: string, category: string, muscle_groups: string[], equipment: string[], joints: string[], difficulty: number, technique: string) => ({
  id: `demo-${slug}`, slug, name, category, muscle_groups, equipment, joints, difficulty, variant_of: null, technique,
  media_webm: null, media_webp: null, media_poster: null, created_at: jetzt(),
});

// Übungen wie supabase/seed.sql (Platzhalter, neutrale Technikhinweise).
function startdaten(): Speicher {
  return {
    profiles: [
      {
        id: DEMO_NUTZER.id,
        created_at: jetzt(),
        adult_confirmed_at: jetzt(),
        onboarding_completed_at: jetzt(),
        goals: ["kraeftiger"],
        goal_note: null,
        days_per_week: 3,
        minutes_per_session: 30,
        experience: "anfaenger",
        equipment: ["kurzhanteln"],
        weight_step_kg: 2.5,
      },
    ],
    consents: (["A", "B"] as const).map((kind) => ({
      id: `demo-consent-${kind}`, user_id: DEMO_NUTZER.id, kind, text_version: EINWILLIGUNGSTEXTE[kind].version, granted_at: jetzt(), revoked_at: null,
    })),
    exercises: [
      uebung("liegestuetz", "Liegestütz", "bodyweight", ["brust", "trizeps", "schulter"], [], ["schulter", "handgelenk"], 1, "Hände unter den Schultern aufsetzen, Körper in einer Linie halten, Brust kontrolliert absenken und wieder hochdrücken."),
      uebung("kniebeuge-koerpergewicht", "Kniebeuge (Körpergewicht)", "bodyweight", ["beine", "gesaess"], [], ["knie", "huefte"], 1, "Füße schulterbreit, Gesäß nach hinten unten schieben, Oberkörper aufrecht, wieder aufstehen."),
      uebung("plank", "Unterarmstütz (Plank)", "bodyweight", ["rumpf"], [], ["schulter", "ruecken"], 1, "Ellbogen unter den Schultern, Körper bildet eine Linie, ruhig weiteratmen."),
      uebung("kniebeuge-langhantel", "Kniebeuge mit Langhantel", "kraft", ["beine", "gesaess", "rumpf"], ["langhantel", "kniebeugenstaender"], ["knie", "huefte", "ruecken"], 2, "Stange fest auf dem oberen Rücken, Rumpf anspannen, kontrolliert absenken und aus den Beinen aufrichten."),
      uebung("bankdruecken-kurzhantel", "Bankdrücken mit Kurzhanteln", "kraft", ["brust", "trizeps", "schulter"], ["kurzhanteln", "flachbank"], ["schulter", "handgelenk"], 2, "Schulterblätter zusammenziehen, Hanteln kontrolliert senken und über der Brust wieder nach oben drücken."),
      uebung("rudern-kurzhantel", "Rudern mit Kurzhantel", "kraft", ["ruecken", "bizeps"], ["kurzhanteln"], ["ruecken", "schulter"], 1, "Rücken gerade, Hantel zur Hüfte ziehen und kontrolliert wieder absenken."),
      uebung("joggen", "Joggen", "cardio", ["beine"], [], ["knie", "huefte"], 1, "Aufrechte Haltung, gleichmäßiger Schritt in einem Tempo, bei dem Sprechen noch möglich ist."),
      uebung("huefte-kreisen", "Hüftkreisen", "mobility", ["huefte"], [], ["huefte"], 1, "Aufrecht stehen, große langsame Kreise in beide Richtungen ausführen."),
      uebung("oberschenkel-dehnen", "Oberschenkel dehnen", "dehnen", ["beine"], [], ["knie"], 1, "Im Stand die Ferse zum Gesäß führen, Position ruhig halten und gleichmäßig atmen."),
    ],
  };
}

// Spalten-Defaults wie in den Migrationen, soweit die App sie liest.
const DEFAULTS: Record<string, () => Zeile> = {
  consents: () => ({ granted_at: jetzt(), revoked_at: null }),
  water_logs: () => ({ logged_at: jetzt() }),
  workouts: () => ({ started_at: jetzt(), ended_at: null, regeneration: null, note: null }),
  meals: () => ({ eaten_at: jetzt(), amount_note: null, kcal: null, protein_g: null, carbs_g: null, fat_g: null, source: "manuell", estimated: false }),
  pantry_items: () => ({ ingredient_key: null, amount: null, unit: null, location: "kuehlschrank", best_before: null, source: "manuell" }),
  shopping_items: () => ({ ingredient_key: null, amount: null, unit: null, done: false, recipe_slug: null }),
  kitchen_appliances: () => ({ model: null }),
  activity_logs: () => ({ started_at: jetzt(), distance_km: null, effort: null, note: null }),
  workout_sets: () => ({ technique: "sauber", pain: false, created_at: jetzt() }),
  body_measurements: () => ({ measured_on: jetzt().slice(0, 10) }),
  training_plans: () => ({ source: "regeln", general: false, active: true, created_at: jetzt() }),
};
// Eindeutigkeit wie in den Migrationen; Verstoß → 23505 wie bei Postgres.
const EINDEUTIG: Record<string, (neu: Zeile, alt: Zeile) => boolean> = {
  consents: (n, a) => n.kind === a.kind && n.revoked_at === null && a.revoked_at === null,
  kitchen_appliances: (n, a) => n.user_id === a.user_id && n.kind === a.kind,
  workout_sets: (n, a) => n.workout_id === a.workout_id && n.set_no === a.set_no && n.exercise_id === a.exercise_id,
};
const FREMDSCHLUESSEL: Record<string, string> = { workouts: "workout_id", exercises: "exercise_id", training_plans: "plan_id" };

// Ein Speicher je Serverprozess; ein Neustart setzt auf die Startdaten zurück.
const global = globalThis as { __lifestyleDemo?: Speicher };
const speicher = () => (global.__lifestyleDemo ??= startdaten());
export const setzeZurueck = () => void (global.__lifestyleDemo = startdaten());

function ilike(muster: string) {
  // % und _ sind Platzhalter, mit \ maskiert stehen sie für sich selbst (siehe ilikeMuster in lib/training/katalog.ts).
  const quelle = muster.replace(/\\(.)|[%_]|[.*+?^${}()|[\]]/g, (z, maskiert) =>
    maskiert !== undefined ? maskiert.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : z === "%" ? ".*" : z === "_" ? "." : `\\${z}`,
  );
  return new RegExp(`^${quelle}$`, "i");
}

function passt(zeile: Zeile, { m, a }: Op): boolean {
  const [spalte, wert] = a as [string, unknown];
  switch (m) {
    case "neq":
      return (zeile[spalte] ?? null) !== wert;
    case "eq":
    case "is":
      return (zeile[spalte] ?? null) === wert;
    case "in":
      return (wert as unknown[]).includes(zeile[spalte]);
    case "gte":
      return (zeile[spalte] as string | number) >= (wert as string | number);
    case "lt":
      return (zeile[spalte] as string | number) < (wert as string | number);
    case "ilike":
      return ilike(String(wert)).test(String(zeile[spalte] ?? ""));
    case "not":
      return !passt(zeile, { m: String(a[1]), a: [spalte, a[2]] });
    case "match":
      return Object.entries(a[0] as Zeile).every(([s, w]) => zeile[s] === w);
    default:
      return true;
  }
}

function spalten(auswahl: string): string[] {
  const teile: string[] = [];
  let tiefe = 0;
  let teil = "";
  for (const z of auswahl) {
    if (z === "(") tiefe++;
    if (z === ")") tiefe--;
    if (z === "," && tiefe === 0) {
      teile.push(teil.trim());
      teil = "";
    } else teil += z;
  }
  return [...teile, teil.trim()].filter(Boolean);
}

function projiziere(zeile: Zeile, auswahl: string | undefined): Zeile {
  if (!auswahl || auswahl.trim() === "*") return { ...zeile };
  return Object.fromEntries(
    spalten(auswahl).map((s) => {
      const eingebettet = /^(\w+)\((.*)\)$/.exec(s);
      if (!eingebettet) return [s, zeile[s] ?? null];
      const [, tabelle, innen] = eingebettet;
      const ziel = (speicher()[tabelle] ?? []).find((z) => z.id === zeile[FREMDSCHLUESSEL[tabelle]]);
      return [tabelle, ziel ? projiziere(ziel, innen) : null];
    }),
  );
}

const doppelt = (code = "23505"): Antwort => ({ data: null, error: { code, message: "duplicate key value violates unique constraint" } });

export function fuehreAbfrage(tabelle: string, ops: Op[]): Antwort {
  const db = speicher();
  const zeilen = (db[tabelle] ??= []);
  const op = (m: string) => ops.find((o) => o.m === m);
  const treffer = () => zeilen.filter((z) => ops.every((o) => passt(z, o)));
  const neu = (werte: Zeile): Zeile => ({ id: crypto.randomUUID(), created_at: jetzt(), ...DEFAULTS[tabelle]?.(), ...werte });
  const kollidiert = (z: Zeile) => zeilen.some((a) => a !== z && (a.id === z.id || EINDEUTIG[tabelle]?.(z, a)));

  let betroffen: Zeile[];
  const schreiben = op("insert") ?? op("upsert") ?? op("update") ?? op("delete");
  if (!schreiben) betroffen = treffer();
  else if (schreiben.m === "insert") {
    betroffen = [schreiben.a[0]].flat().map((w) => neu(w as Zeile));
    if (betroffen.some(kollidiert)) return doppelt();
    zeilen.push(...betroffen);
  } else if (schreiben.m === "upsert") {
    const { onConflict = "id", ignoreDuplicates = false } = (schreiben.a[1] ?? {}) as { onConflict?: string; ignoreDuplicates?: boolean };
    const schluessel = onConflict.split(",").map((s) => s.trim());
    betroffen = [];
    for (const werte of [schreiben.a[0]].flat() as Zeile[]) {
      const alt = zeilen.find((z) => schluessel.every((s) => z[s] === werte[s]));
      if (!alt) zeilen.push(neu(werte));
      else if (!ignoreDuplicates) Object.assign(alt, werte);
      betroffen.push(alt ?? zeilen[zeilen.length - 1]);
    }
  } else if (schreiben.m === "update") {
    betroffen = treffer();
    for (const z of betroffen) {
      const geaendert = { ...z, ...(schreiben.a[0] as Zeile) };
      if (zeilen.some((a) => a !== z && EINDEUTIG[tabelle]?.(geaendert, a))) return doppelt();
      Object.assign(z, geaendert);
    }
  } else {
    betroffen = treffer();
    db[tabelle] = zeilen.filter((z) => !betroffen.includes(z));
  }

  const auswahl = op("select");
  const einzeln = op("single") ?? op("maybeSingle");
  if (schreiben && !auswahl) return { data: null, error: null };

  let ergebnis = [...betroffen];
  // Mehrere order()-Aufrufe: der erste zählt am stärksten, deshalb rückwärts stabil sortieren.
  for (const o of ops.filter((x) => x.m === "order").reverse()) {
    const [spalte, { ascending = true } = {}] = o.a as [string, { ascending?: boolean }?];
    ergebnis.sort((x, y) => {
      const [a, b] = [x[spalte] as string | number, y[spalte] as string | number];
      return (a < b ? -1 : a > b ? 1 : 0) * (ascending ? 1 : -1);
    });
  }
  const limit = op("limit");
  if (limit) ergebnis = ergebnis.slice(0, limit.a[0] as number);
  const daten = ergebnis.map((z) => projiziere(z, auswahl?.a[0] as string | undefined));
  if (!einzeln) return { data: daten, error: null };
  if (daten.length === 1) return { data: daten[0], error: null };
  if (daten.length === 0 && einzeln.m === "maybeSingle") return { data: null, error: null };
  return { data: null, error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" } };
}

// delete_own_data: Im Demo-Modus gibt es kein Konto zu löschen; die Daten gehen auf den Startzustand zurück.
export function fuehreRpc(name: string): Antwort {
  if (name !== "delete_own_data") return { data: null, error: { code: "PGRST202", message: "Funktion im Demo-Modus nicht vorhanden" } };
  setzeZurueck();
  return { data: null, error: null };
}
