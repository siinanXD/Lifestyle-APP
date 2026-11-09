import { describe, expect, test } from "vitest";
import { erstellePlan, type Angaben, type Plan, type Uebung } from "../../lib/training/plan";
import { PLAN_HINWEISE } from "../../lib/training/plan-texte";

const u = (slug: string, category: Uebung["category"], muscle_groups: string[], teil: Partial<Uebung> = {}): Uebung => ({
  slug,
  category,
  muscle_groups,
  equipment: [],
  joints: [],
  variant_of: null,
  ...teil,
});

// Erfundener Katalog; Felder wie lifestyle.exercises plus joints/variant_of (SIN-1267).
const KATALOG: Uebung[] = [
  u("ausfallschritt", "bodyweight", ["beine", "gesaess"], { joints: ["knie"] }),
  u("bankdruecken-langhantel", "kraft", ["brust", "trizeps"], { equipment: ["langhantel"], joints: ["schulter"] }),
  u("bruecke", "bodyweight", ["gesaess", "rumpf"]),
  u("joggen", "cardio", ["beine"], { joints: ["knie"] }),
  u("katze-kuh", "mobility", ["ruecken"]),
  u("kniebeuge", "bodyweight", ["beine", "gesaess"], { joints: ["knie"] }),
  u("kniebeuge-erhoeht", "bodyweight", ["beine", "gesaess"], { variant_of: "kniebeuge" }),
  u("kniebeuge-langhantel", "kraft", ["beine", "gesaess", "rumpf"], { equipment: ["langhantel"], joints: ["knie", "ruecken"] }),
  u("liegestuetz", "bodyweight", ["brust", "trizeps", "schulter"], { joints: ["handgelenk"] }),
  u("oberschenkel-dehnen", "dehnen", ["beine"]),
  u("pike-liegestuetz", "bodyweight", ["schulter"]),
  u("plank", "bodyweight", ["rumpf"]),
  u("rudern-kurzhantel", "kraft", ["ruecken", "bizeps"], { equipment: ["kurzhanteln"] }),
  u("rudern-tisch", "bodyweight", ["ruecken", "bizeps"]),
  u("schulterdruecken-kurzhantel", "kraft", ["schulter", "trizeps"], { equipment: ["kurzhanteln"] }),
  u("schulterkreisen", "mobility", ["schulter"]),
  u("seilspringen", "cardio", ["beine"]),
];

const uebungen = (plan: Plan) => plan.tage.flatMap((t) => t.positionen.map((p) => p.uebung));
const slugs = (plan: Plan) => uebungen(plan).map((x) => x.slug);

describe("erstellePlan: Geräte", () => {
  test.each<[Angaben["geraete"]]>([[["keine"]], [[]]])("Geräte %j: nur Übungen ohne Geräte", (geraete) => {
    const plan = erstellePlan({ geraete, tageProWoche: 3, minutenProEinheit: 60 }, KATALOG);
    expect(uebungen(plan).length).toBeGreaterThan(0);
    expect(uebungen(plan).every((x) => x.equipment.length === 0)).toBe(true);
  });

  test("Kurzhanteln: Auswahl mit Kurzhanteln, ohne Langhantel", () => {
    const plan = erstellePlan({ geraete: ["kurzhanteln"], tageProWoche: 3, minutenProEinheit: 60 }, KATALOG);
    expect(slugs(plan)).toContain("rudern-kurzhantel");
    expect(uebungen(plan).some((x) => x.equipment.includes("langhantel"))).toBe(false);
  });

  test("Fitnessstudio: alle Geräte gelten als vorhanden", () => {
    const plan = erstellePlan({ geraete: ["studio"], tageProWoche: 3, minutenProEinheit: 60 }, KATALOG);
    expect(slugs(plan)).toContain("kniebeuge-langhantel");
  });
});

describe("erstellePlan: Einschränkungen", () => {
  test("knie: keine Übung mit Gelenk knie, Hinweis, Ersatz durch Variante", () => {
    const plan = erstellePlan({ einschraenkungen: ["knie"], tageProWoche: 3, minutenProEinheit: 60, ziele: ["mehr_ausdauer"] }, KATALOG);
    expect(uebungen(plan).some((x) => x.joints.includes("knie"))).toBe(false);
    expect(plan.hinweise).toContain("uebung_angepasst");
    expect(slugs(plan)).toContain("kniebeuge-erhoeht");
    expect(slugs(plan)).toContain("seilspringen");
  });

  test("ohne Einschränkung: Grundübung statt Variante, kein Hinweis", () => {
    const plan = erstellePlan({ tageProWoche: 3, minutenProEinheit: 60 }, KATALOG);
    expect(slugs(plan)).toContain("kniebeuge");
    expect(slugs(plan)).not.toContain("kniebeuge-erhoeht");
    expect(plan.hinweise).toEqual([]);
  });

  test("Einschränkung ohne betroffene Übung: kein Hinweis", () => {
    expect(erstellePlan({ einschraenkungen: ["sonstiges"] }, KATALOG).hinweise).toEqual([]);
  });
});

describe("erstellePlan: Aufteilung und Zeitbudget", () => {
  const bezeichnungen = (tageProWoche: number) => erstellePlan({ tageProWoche, geraete: ["studio"] }, KATALOG).tage.map((t) => t.bezeichnung);

  test("2 Tage: Ganzkörper je Tag", () => {
    expect(bezeichnungen(2)).toEqual(["Ganzkörper", "Ganzkörper"]);
  });

  test("4 Tage: Oberkörper/Unterkörper im Wechsel", () => {
    const plan = erstellePlan({ tageProWoche: 4, geraete: ["studio"] }, KATALOG);
    expect(plan.tage.map((t) => t.bezeichnung)).toEqual(["Oberkörper", "Unterkörper", "Oberkörper", "Unterkörper"]);
    expect(plan.tage.map((t) => t.tagNr)).toEqual([1, 2, 3, 4]);
    const oben = ["brust", "ruecken", "schulter", "bizeps", "trizeps"];
    for (const tag of plan.tage) {
      expect(tag.positionen.length).toBeGreaterThan(0);
      expect(tag.positionen.every((p) => p.uebung.muscle_groups.some((m) => oben.includes(m) === (tag.bezeichnung === "Oberkörper")))).toBe(true);
    }
  });

  test("6 Tage: drei Ganzkörpertage, sonst Mobility/Cardio", () => {
    const plan = erstellePlan({ tageProWoche: 6, geraete: ["studio"] }, KATALOG);
    expect(plan.tage.map((t) => t.bezeichnung)).toEqual([
      "Ganzkörper",
      "Mobility/Cardio",
      "Ganzkörper",
      "Mobility/Cardio",
      "Ganzkörper",
      "Mobility/Cardio",
    ]);
    const locker = plan.tage[1].positionen.map((p) => p.uebung.category);
    expect(locker.length).toBeGreaterThan(0);
    expect(locker.every((c) => ["cardio", "mobility", "dehnen"].includes(c))).toBe(true);
    expect(bezeichnungen(5).filter((b) => b === "Ganzkörper")).toHaveLength(3);
  });

  test.each([
    [15, 3],
    [30, 4],
    [45, 6],
    [60, 8],
  ] as const)("%i Minuten: %i Übungen je Einheit", (minutenProEinheit, anzahl) => {
    const plan = erstellePlan({ minutenProEinheit, tageProWoche: 2, geraete: ["studio"] }, KATALOG);
    expect(plan.tage.map((t) => t.positionen.length)).toEqual([anzahl, anzahl]);
  });

  test("keine Übung doppelt am selben Tag", () => {
    for (const tag of erstellePlan({ tageProWoche: 3, minutenProEinheit: 60 }, KATALOG).tage) {
      const tagSlugs = tag.positionen.map((p) => p.uebung.slug);
      expect(new Set(tagSlugs).size).toBe(tagSlugs.length);
    }
  });

  test("jede Hauptmuskelgruppe pro Woche mindestens einmal", () => {
    const plan = erstellePlan({ tageProWoche: 3, minutenProEinheit: 30, geraete: ["studio"] }, KATALOG);
    const gruppen = new Set(uebungen(plan).flatMap((x) => x.muscle_groups));
    for (const g of ["beine", "gesaess", "brust", "ruecken", "schulter", "rumpf"]) expect(gruppen).toContain(g);
    expect(gruppen.has("bizeps") || gruppen.has("trizeps")).toBe(true);
  });

  test.each([0, 7, 2.5])("tageProWoche %s wirft", (tageProWoche) => {
    expect(() => erstellePlan({ tageProWoche }, KATALOG)).toThrow("tageProWoche muss eine ganze Zahl von 1 bis 6 sein");
  });
});

describe("erstellePlan: Ziele", () => {
  const basis: Angaben = { tageProWoche: 2, minutenProEinheit: 30, geraete: ["studio"] };
  const mit = (gruppe: string, plan: Plan) => uebungen(plan).filter((x) => x.muscle_groups.includes(gruppe)).length;

  test("breitere Schultern: mehr Übungen für Schultern und Rücken", () => {
    const ohne = erstellePlan(basis, KATALOG);
    const plan = erstellePlan({ ...basis, ziele: ["breitere_schultern"] }, KATALOG);
    expect(mit("schulter", plan) + mit("ruecken", plan)).toBeGreaterThan(mit("schulter", ohne) + mit("ruecken", ohne));
  });

  test("mehr Ausdauer: Cardio-Block am Ende jeder Krafteinheit, Übungszahl bleibt", () => {
    const plan = erstellePlan({ ...basis, ziele: ["mehr_ausdauer"] }, KATALOG);
    for (const tag of plan.tage) {
      expect(tag.positionen).toHaveLength(4);
      expect(tag.positionen.at(-1)?.uebung.category).toBe("cardio");
    }
  });

  test("beweglicher: Mobility in jeder Einheit", () => {
    const plan = erstellePlan({ ...basis, ziele: ["beweglicher"] }, KATALOG);
    expect(plan.tage.every((t) => t.positionen.some((p) => ["mobility", "dehnen"].includes(p.uebung.category)))).toBe(true);
  });

  test("kräftiger: Kraftübungen vor Körpergewicht", () => {
    const anteil = (plan: Plan) => uebungen(plan).filter((x) => x.category === "kraft").length;
    expect(anteil(erstellePlan({ ...basis, ziele: ["kraeftiger"] }, KATALOG))).toBeGreaterThan(anteil(erstellePlan(basis, KATALOG)));
  });
});

describe("erstellePlan: ohne Angaben, Erfahrung, Comeback", () => {
  test("leere Angaben: allgemeiner Einsteigerplan (Bodyweight, 3 Einheiten, ca. 30 Minuten)", () => {
    const plan = erstellePlan({}, KATALOG);
    expect(plan.allgemein).toBe(true);
    expect(plan.tage.map((t) => t.bezeichnung)).toEqual(["Ganzkörper", "Ganzkörper", "Ganzkörper"]);
    expect(plan.tage.every((t) => t.positionen.length === 4)).toBe(true);
    expect(uebungen(plan).every((x) => x.equipment.length === 0)).toBe(true);
    expect(plan.tage[0].positionen[0]).toMatchObject({ saetze: 2, wdhMin: 10, wdhMax: 15 });
    expect(erstellePlan({ ziele: [], geraete: [], einschraenkungen: [] }, KATALOG).allgemein).toBe(true);
  });

  test("eine Angabe genügt: nicht allgemein", () => {
    expect(erstellePlan({ erfahrung: "anfaenger" }, KATALOG).allgemein).toBe(false);
    expect(erstellePlan({ geraete: ["keine"] }, KATALOG).allgemein).toBe(false);
  });

  test.each([
    ["anfaenger", 2, 10, 15],
    ["wiedereinstieg", 2, 10, 15],
    ["regelmaessig", 3, 8, 12],
  ] as const)("Erfahrung %s: %i Sätze, %i bis %i Wiederholungen", (erfahrung, saetze, wdhMin, wdhMax) => {
    const positionen = erstellePlan({ erfahrung }, KATALOG).tage.flatMap((t) => t.positionen);
    expect(positionen.every((p) => p.saetze === saetze && p.wdhMin === wdhMin && p.wdhMax === wdhMax)).toBe(true);
  });

  test("Comeback-Stufe 2: ein Satz weniger, Hinweis sanfter_einstieg", () => {
    const plan = erstellePlan({ erfahrung: "regelmaessig", comebackStufe: 2 }, KATALOG);
    expect(plan.tage.flatMap((t) => t.positionen).every((p) => p.saetze === 2)).toBe(true);
    expect(plan.hinweise).toEqual(["sanfter_einstieg"]);
    expect(erstellePlan({ erfahrung: "anfaenger", comebackStufe: 3 }, KATALOG).tage[0].positionen[0].saetze).toBe(1);
    expect(erstellePlan({ erfahrung: "regelmaessig", comebackStufe: 0 }, KATALOG).hinweise).toEqual([]);
  });

  test("deterministisch: gleiche Eingabe, gleicher Plan, unabhängig von der Katalogreihenfolge; Eingabe bleibt unverändert", () => {
    const angaben: Angaben = { ziele: ["breitere_schultern", "mehr_ausdauer"], tageProWoche: 5, einschraenkungen: ["knie"], geraete: ["kurzhanteln"] };
    const eingabe = structuredClone({ angaben, katalog: KATALOG });
    const plan = erstellePlan(eingabe.angaben, eingabe.katalog);
    expect(erstellePlan(eingabe.angaben, eingabe.katalog)).toEqual(plan);
    expect(erstellePlan(eingabe.angaben, [...eingabe.katalog].reverse())).toEqual(plan);
    expect(eingabe).toEqual({ angaben, katalog: KATALOG });
  });

  test("leerer Katalog: Tage ohne Positionen, kein Fehler", () => {
    expect(erstellePlan({ tageProWoche: 5 }, []).tage.every((t) => t.positionen.length === 0)).toBe(true);
  });

  test("jeder Hinweis-Code hat einen Text ohne medizinische Aussage", () => {
    for (const text of Object.values(PLAN_HINWEISE)) expect(text).not.toMatch(/diagnos|heil|therap|verletz|schmerz/i);
  });
});
