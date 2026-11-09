import type { Antworten } from "../onboarding/flow";
import type { Comeback } from "./comeback";
import type { PLAN_HINWEISE } from "./plan-texte";

// Felder wie lifestyle.exercises; `joints` und `variant_of` (Slug der Grundübung) kommen mit dem Katalog (SIN-1267).
export type Uebung = {
  slug: string;
  category: "kraft" | "cardio" | "bodyweight" | "mobility" | "dehnen";
  muscle_groups: string[];
  equipment: string[];
  joints: string[];
  variant_of: string | null;
};

export type Angaben = Pick<Antworten, "ziele" | "tageProWoche" | "minutenProEinheit" | "erfahrung" | "geraete" | "einschraenkungen"> & {
  comebackStufe?: Comeback["stufe"];
};

export type Hinweis = keyof typeof PLAN_HINWEISE;

// Passt zu lifestyle.training_plans/plan_items (SIN-1282): allgemein → general, tagNr → day_no, Index → position,
// saetze → sets, wdhMin/wdhMax → rep_min/rep_max.
export type Plan<U extends Uebung = Uebung> = {
  allgemein: boolean;
  tage: { tagNr: number; bezeichnung: string; positionen: { uebung: U; saetze: number; wdhMin: number; wdhMax: number }[] }[];
  hinweise: Hinweis[];
};

// Annahmen aus SIN-1283 (keine Vorgabe von Sinan), bewusst als Konstanten.
const EINSTEIGER = { saetze: 2, wdhMin: 10, wdhMax: 15 }; // auch Wiedereinstieg und fehlende Angabe
const REGELMAESSIG = { saetze: 3, wdhMin: 8, wdhMax: 12 };
const STANDARD_TAGE = 3; // docs/ONBOARDING.md: ohne Angaben 2 bis 3 Einheiten, ca. 30 Minuten
const STANDARD_MINUTEN = 30;
const MINUTEN_JE_UEBUNG = 8;
const UEBUNGEN_MIN = 3;
const UEBUNGEN_MAX = 8;
const SCHWERPUNKT_GEWICHT = 2;

type Tagesart = { bezeichnung: string; gruppen: string[] }; // ohne Gruppen = Mobility/Cardio
const OBERKOERPER: Tagesart = { bezeichnung: "Oberkörper", gruppen: ["brust", "ruecken", "schulter", "arme"] };
const UNTERKOERPER: Tagesart = { bezeichnung: "Unterkörper", gruppen: ["beine", "gesaess", "rumpf"] };
const GANZKOERPER: Tagesart = { bezeichnung: "Ganzkörper", gruppen: [...UNTERKOERPER.gruppen, ...OBERKOERPER.gruppen] };
const LOCKER: Tagesart = { bezeichnung: "Mobility/Cardio", gruppen: [] };

function tagesarten(tage: number): Tagesart[] {
  if (tage <= 3) return Array<Tagesart>(tage).fill(GANZKOERPER);
  if (tage === 4) return [OBERKOERPER, UNTERKOERPER, OBERKOERPER, UNTERKOERPER];
  return Array.from({ length: tage }, (_, i) => (i % 2 === 0 ? GANZKOERPER : LOCKER));
}

const gruppenVon = (u: Uebung) => u.muscle_groups.map((m) => (m === "bizeps" || m === "trizeps" ? "arme" : m));
const istKraft = (u: Uebung) => u.category === "kraft" || u.category === "bodyweight";
const istCardio = (u: Uebung) => u.category === "cardio";
const istMobility = (u: Uebung) => u.category === "mobility" || u.category === "dehnen";

/**
 * Trainingsplan aus Regeln, nie aus der KI: gleiche Eingabe → gleicher Plan (Sortierung nach `slug`, kein Zufall, kein Datenbankzugriff).
 * Ohne jede Angabe entsteht der allgemeine Einsteigerplan (`allgemein: true`). Hinweise sind Codes, Texte stehen in plan-texte.ts.
 * Die Wochenabdeckung der Hauptmuskelgruppen gilt, soweit Katalog und Zeitbudget es hergeben.
 */
export function erstellePlan<U extends Uebung>(angaben: Angaben, katalog: U[]): Plan<U> {
  const ziele = angaben.ziele ?? [];
  const geraete: string[] = angaben.geraete ?? [];
  const einschraenkungen: string[] = angaben.einschraenkungen ?? [];
  const comeback = (angaben.comebackStufe ?? 0) >= 1;
  const tageProWoche = angaben.tageProWoche ?? STANDARD_TAGE;
  if (!Number.isInteger(tageProWoche) || tageProWoche < 1 || tageProWoche > 6) {
    throw new Error("tageProWoche muss eine ganze Zahl von 1 bis 6 sein");
  }
  const anzahl = Math.min(
    Math.max(Math.round((angaben.minutenProEinheit ?? STANDARD_MINUTEN) / MINUTEN_JE_UEBUNG), UEBUNGEN_MIN),
    UEBUNGEN_MAX,
  );

  // „studio“ heißt: alle Geräte vorhanden; „keine“ kommt in keinem `equipment` vor und wirkt wie leer.
  const machbar = [...katalog]
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .filter((u) => geraete.includes("studio") || u.equipment.every((e) => geraete.includes(e)));
  const beruehrt = (u: Uebung) => u.joints.some((j) => einschraenkungen.includes(j));
  const frei = machbar.filter((u) => !beruehrt(u));
  // Eine Variante kommt nur zum Zug, wenn ihre Grundübung nicht möglich ist; so ersetzt sie die ausgelassene Übung.
  const pool = frei.filter((u) => !frei.some((b) => b.slug === u.variant_of));

  const genutzt = new Map<string, number>(); // Slug → Einsätze in dieser Woche
  const abgedeckt = new Map<string, number>(); // Muskelgruppe → Kraftübungen in dieser Woche
  const quote = (g: string) =>
    (abgedeckt.get(g) ?? 0) / (ziele.includes("breitere_schultern") && (g === "schulter" || g === "ruecken") ? SCHWERPUNKT_GEWICHT : 1);
  const rang = (u: Uebung) => (ziele.includes("kraeftiger") && u.category !== "kraft" ? 1 : 0);

  // Stabile Sortierung über dem nach Slug sortierten Pool: selten genutzte zuerst, bei Gleichstand der kleinere Slug.
  const nimm = (heute: U[], passt: (u: Uebung) => boolean): U | undefined => {
    const [kandidat] = pool
      .filter((u) => !heute.includes(u) && passt(u))
      .sort((a, b) => rang(a) - rang(b) || (genutzt.get(a.slug) ?? 0) - (genutzt.get(b.slug) ?? 0));
    if (!kandidat) return undefined;
    heute.push(kandidat);
    genutzt.set(kandidat.slug, (genutzt.get(kandidat.slug) ?? 0) + 1);
    return kandidat;
  };

  const zusatz = [
    ...(ziele.includes("mehr_ausdauer") ? [istCardio] : []),
    ...(ziele.includes("beweglicher") ? [istMobility] : []),
  ].filter((passt) => pool.some(passt));
  const vorgabe = angaben.erfahrung === "regelmaessig" ? REGELMAESSIG : EINSTEIGER;
  const saetze = Math.max(vorgabe.saetze - (comeback ? 1 : 0), 1);

  const tage = tagesarten(tageProWoche).map(({ bezeichnung, gruppen }, i) => {
    const heute: U[] = [];
    if (gruppen.length === 0) {
      // Mobility und Cardio im Wechsel; fehlt eine Art, füllt die andere auf.
      while (heute.length < anzahl) {
        const [erst, dann] = heute.length % 2 === 0 ? [istMobility, istCardio] : [istCardio, istMobility];
        if (!nimm(heute, erst) && !nimm(heute, dann)) break;
      }
    } else {
      while (heute.length < anzahl - zusatz.length) {
        const passend = (g: string) => (u: Uebung) => istKraft(u) && gruppenVon(u).includes(g);
        const offen = gruppen.filter((g) => pool.some((u) => !heute.includes(u) && passend(g)(u)));
        if (offen.length === 0) break;
        // Die in dieser Woche am wenigsten bediente Gruppe ist dran; Ziele gewichten über `quote`.
        const gruppe = offen.reduce((beste, g) => (quote(g) < quote(beste) ? g : beste));
        const uebung = nimm(heute, passend(gruppe))!;
        for (const g of new Set(gruppenVon(uebung))) abgedeckt.set(g, (abgedeckt.get(g) ?? 0) + 1);
      }
      for (const passt of zusatz) nimm(heute, passt);
    }
    // shortcut: Cardio und Mobility tragen dieselben Satz-/Wiederholungswerte, eigene Dauerangabe sobald plan_items sie kennt.
    return {
      tagNr: i + 1,
      bezeichnung,
      positionen: heute.map((uebung) => ({ uebung, saetze, wdhMin: vorgabe.wdhMin, wdhMax: vorgabe.wdhMax })),
    };
  });

  return {
    allgemein:
      ziele.length === 0 &&
      geraete.length === 0 &&
      einschraenkungen.length === 0 &&
      angaben.tageProWoche === undefined &&
      angaben.minutenProEinheit === undefined &&
      angaben.erfahrung === undefined,
    tage,
    hinweise: [...(machbar.some(beruehrt) ? (["uebung_angepasst"] as const) : []), ...(comeback ? (["sanfter_einstieg"] as const) : [])],
  };
}
