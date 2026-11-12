import type { Kuechengeraet } from "./geraete";
import type { Einheit } from "./kueche";
import { BASED_REZEPTE } from "./rezepte-based";
import { istGrundzutat, type ZutatKey } from "./zutaten";

// Rezeptsammlung für Smart Cooking (SIN-1626): eigene, selbst geschriebene Rezepte, dazu gemeinfreie Rezepte mit Bild
// aus based.cooking (siehe rezepte-based.ts).
// Nährwerte je Portion sind grobe Schätzungen und werden in der App so gekennzeichnet.
export type Rezeptzutat = { key: ZutatKey; menge?: number; einheit?: Einheit; optional?: true };
export type Rezept = {
  slug: string;
  name: string;
  minuten: number;
  portionen: number;
  /** Alle genannten Geräte werden gebraucht; leer = ohne Gerät. */
  geraete: Kuechengeraet[];
  kost: "vegan" | "vegetarisch" | "alles";
  genuss?: true;
  kcal: number;
  protein_g: number;
  zutaten: Rezeptzutat[];
  schritte: string[];
  /** Pfad zum Foto unter public/, falls es eins gibt. */
  bild?: string;
  /** Herkunft, wenn das Rezept nicht selbst geschrieben ist. */
  quelle?: "based.cooking";
};

export const FILTER = { fitness: "Fitness", schnell: "Schnell", genuss: "Sehr lecker", vegetarisch: "Vegetarisch", vegan: "Vegan" } as const;
export type Filter = keyof typeof FILTER;

// Annahmen (keine Vorgabe von Sinan, als Konstanten änderbar):
export const SCHNELL_BIS_MIN = 20; // „schnell“ = höchstens 20 Minuten
export const FITNESS_AB_PROTEIN_G = 25; // „Fitness“ = mindestens 25 g Eiweiß …
export const FITNESS_BIS_KCAL = 650; // … und höchstens 650 kcal je Portion
export const WENIG_FEHLT_BIS = 3; // „Es fehlt wenig“ = höchstens 3 Zutaten

/** Kennzeichen eines Rezepts. „Schnell“ und „Fitness“ werden aus Zeit und Nährwerten berechnet, nicht von Hand vergeben. */
export function hatKennzeichen(r: Rezept, f: Filter): boolean {
  switch (f) {
    case "fitness":
      return r.protein_g >= FITNESS_AB_PROTEIN_G && r.kcal <= FITNESS_BIS_KCAL;
    case "schnell":
      return r.minuten <= SCHNELL_BIS_MIN;
    case "genuss":
      return r.genuss === true;
    case "vegetarisch":
      return r.kost === "vegetarisch" || r.kost === "vegan";
    case "vegan":
      return r.kost === "vegan";
  }
}
export const kennzeichen = (r: Rezept) => (Object.keys(FILTER) as Filter[]).filter((f) => hatKennzeichen(r, f));

export type Vorschlag = { rezept: Rezept; fehlend: ZutatKey[] };

/**
 * Rezepte, die mit den vorhandenen Geräten gehen und zu allen gewählten Filtern passen, sortiert nach fehlenden Zutaten
 * (dann nach Zeit). Grundzutaten (Salz, Pfeffer, Öl, Wasser) gelten als vorhanden, freiwillige Zutaten fehlen nie.
 * shortcut: Es zählt nur, ob eine Zutat da ist, nicht ob die Menge reicht.
 */
export function schlageVor(rezepte: Rezept[], vorrat: Iterable<string>, geraete: Iterable<string>, filter: Filter[] = []): Vorschlag[] {
  const da = new Set(vorrat);
  const kueche = new Set(geraete);
  return rezepte
    .filter((r) => r.geraete.every((g) => kueche.has(g)) && filter.every((f) => hatKennzeichen(r, f)))
    .map((rezept) => ({ rezept, fehlend: rezept.zutaten.filter((z) => !z.optional && !istGrundzutat(z.key) && !da.has(z.key)).map((z) => z.key) }))
    .sort((a, b) => a.fehlend.length - b.fehlend.length || a.rezept.minuten - b.rezept.minuten || a.rezept.name.localeCompare(b.rezept.name, "de"));
}

export const findeRezept = (slug: string) => REZEPTE.find((r) => r.slug === slug);

const EIGENE: Rezept[] = [
  {
    slug: "ruehrei-brot",
    name: "Rührei mit Brot",
    minuten: 10,
    portionen: 1,
    geraete: ["herd"],
    kost: "vegetarisch",
    kcal: 420,
    protein_g: 24,
    zutaten: [
      { key: "ei", menge: 3, einheit: "stueck" },
      { key: "butter", menge: 10, einheit: "g" },
      { key: "brot", menge: 2, einheit: "stueck" },
    ],
    schritte: [
      "Eier in einer Schüssel verquirlen und mit Salz und Pfeffer würzen.",
      "Butter in der Pfanne bei mittlerer Hitze schmelzen.",
      "Eier hineingeben und langsam rühren, bis sie gerade gestockt sind.",
      "Mit dem Brot servieren.",
    ],
  },
  {
    slug: "haehnchen-reis-pfanne",
    name: "Hähnchen-Reis-Pfanne mit Gemüse",
    minuten: 25,
    portionen: 2,
    geraete: ["herd"],
    kost: "alles",
    kcal: 520,
    protein_g: 42,
    zutaten: [
      { key: "haehnchenbrust", menge: 300, einheit: "g" },
      { key: "reis", menge: 150, einheit: "g" },
      { key: "gemuesemischung", menge: 300, einheit: "g" },
      { key: "sojasauce", optional: true },
    ],
    schritte: [
      "Reis nach Packungsangabe kochen.",
      "Hähnchen in Stücke schneiden und in etwas Öl rundum anbraten, bis es durch ist.",
      "Gemüse dazugeben und einige Minuten mitbraten.",
      "Reis unterheben, mit Sojasauce, Salz und Pfeffer abschmecken.",
    ],
  },
  {
    slug: "airfryer-haehnchen-pommes",
    name: "Hähnchen und Pommes aus dem Airfryer",
    minuten: 25,
    portionen: 2,
    geraete: ["airfryer"],
    kost: "alles", genuss: true,
    kcal: 560,
    protein_g: 40,
    zutaten: [
      { key: "haehnchenbrust", menge: 300, einheit: "g" },
      { key: "pommes", menge: 300, einheit: "g" },
    ],
    schritte: [
      "Hähnchen in Streifen schneiden, mit wenig Öl, Salz und Pfeffer mischen.",
      "Pommes bei 200 °C etwa 10 Minuten im Airfryer garen und einmal schütteln.",
      "Hähnchen dazugeben und weitere 10 bis 12 Minuten garen, bis es durch ist.",
    ],
  },
  {
    slug: "nudeln-tomatensauce",
    name: "Nudeln mit Tomatensoße",
    minuten: 20,
    portionen: 2,
    geraete: ["herd"],
    kost: "vegan",
    kcal: 480,
    protein_g: 16,
    zutaten: [
      { key: "nudeln", menge: 200, einheit: "g" },
      { key: "passierte_tomaten", menge: 400, einheit: "g" },
      { key: "zwiebel", menge: 1, einheit: "stueck" },
      { key: "knoblauch", optional: true },
    ],
    schritte: [
      "Nudeln in Salzwasser bissfest kochen.",
      "Zwiebel würfeln und in Öl glasig anbraten, Knoblauch kurz mitbraten.",
      "Passierte Tomaten dazugeben, 10 Minuten köcheln lassen, mit Salz und Pfeffer abschmecken.",
      "Nudeln abgießen und mit der Soße mischen.",
    ],
  },
  {
    slug: "bolognese",
    name: "Nudeln Bolognese",
    minuten: 30,
    portionen: 2,
    geraete: ["herd"],
    kost: "alles", genuss: true,
    kcal: 700,
    protein_g: 38,
    zutaten: [
      { key: "nudeln", menge: 200, einheit: "g" },
      { key: "hackfleisch", menge: 250, einheit: "g" },
      { key: "passierte_tomaten", menge: 400, einheit: "g" },
      { key: "zwiebel", menge: 1, einheit: "stueck" },
      { key: "tomatenmark", optional: true },
    ],
    schritte: [
      "Zwiebel würfeln und in Öl anbraten.",
      "Hackfleisch dazugeben und krümelig braten, Tomatenmark kurz mitrösten.",
      "Passierte Tomaten dazugeben und 15 Minuten köcheln lassen, abschmecken.",
      "Nudeln in Salzwasser kochen, abgießen und mit der Soße servieren.",
    ],
  },
  {
    slug: "omelett-gemuese",
    name: "Gemüse-Omelett",
    minuten: 15,
    portionen: 1,
    geraete: ["herd"],
    kost: "vegetarisch",
    kcal: 380,
    protein_g: 26,
    zutaten: [
      { key: "ei", menge: 3, einheit: "stueck" },
      { key: "paprika", menge: 1, einheit: "stueck" },
      { key: "tomate", menge: 1, einheit: "stueck" },
      { key: "kaese", optional: true },
    ],
    schritte: [
      "Paprika und Tomate klein würfeln.",
      "Eier verquirlen, mit Salz und Pfeffer würzen.",
      "Gemüse in etwas Öl kurz anbraten, Eier darübergießen.",
      "Bei kleiner Hitze stocken lassen, nach Wunsch Käse darüberstreuen und zusammenklappen.",
    ],
  },
  {
    slug: "quark-beeren",
    name: "Magerquark mit Beeren und Haferflocken",
    minuten: 5,
    portionen: 1,
    geraete: [],
    kost: "vegetarisch",
    kcal: 320,
    protein_g: 35,
    zutaten: [
      { key: "magerquark", menge: 250, einheit: "g" },
      { key: "beeren", menge: 100, einheit: "g" },
      { key: "haferflocken", menge: 30, einheit: "g" },
      { key: "honig", optional: true },
    ],
    schritte: [
      "Quark mit einem Schluck Wasser cremig rühren.",
      "Beeren und Haferflocken darübergeben.",
      "Nach Geschmack mit etwas Honig süßen.",
    ],
  },
  {
    slug: "porridge-banane",
    name: "Haferbrei mit Banane",
    minuten: 10,
    portionen: 1,
    geraete: ["herd"],
    kost: "vegetarisch",
    kcal: 420,
    protein_g: 17,
    zutaten: [
      { key: "haferflocken", menge: 60, einheit: "g" },
      { key: "milch", menge: 250, einheit: "ml" },
      { key: "banane", menge: 1, einheit: "stueck" },
    ],
    schritte: [
      "Haferflocken mit der Milch in einem Topf aufkochen.",
      "Bei kleiner Hitze unter Rühren etwa 3 Minuten quellen lassen.",
      "Banane in Scheiben schneiden und darübergeben.",
    ],
  },
  {
    slug: "porridge-mikrowelle",
    name: "Haferbrei aus der Mikrowelle",
    minuten: 5,
    portionen: 1,
    geraete: ["mikrowelle"],
    kost: "vegan",
    kcal: 380,
    protein_g: 11,
    zutaten: [
      { key: "haferflocken", menge: 60, einheit: "g" },
      { key: "haferdrink", menge: 250, einheit: "ml" },
      { key: "banane", menge: 1, einheit: "stueck" },
    ],
    schritte: [
      "Haferflocken und Haferdrink in einer großen, mikrowellenfesten Schale verrühren.",
      "2 Minuten bei hoher Stufe erhitzen, umrühren und noch einmal 30 Sekunden erhitzen.",
      "Kurz stehen lassen und mit Bananenscheiben servieren.",
    ],
  },
  {
    slug: "ofenkartoffeln-quark",
    name: "Ofenkartoffeln mit Quark",
    minuten: 45,
    portionen: 2,
    geraete: ["ofen"],
    kost: "vegetarisch",
    kcal: 330,
    protein_g: 21,
    zutaten: [
      { key: "kartoffel", menge: 500, einheit: "g" },
      { key: "magerquark", menge: 250, einheit: "g" },
    ],
    schritte: [
      "Ofen auf 200 °C vorheizen.",
      "Kartoffeln waschen, halbieren, mit etwas Öl und Salz mischen und auf ein Blech legen.",
      "Etwa 35 Minuten backen, bis sie weich und goldbraun sind.",
      "Quark mit Salz und Pfeffer glatt rühren und dazu servieren.",
    ],
  },
  {
    slug: "ofengemuese-feta",
    name: "Ofengemüse mit Feta",
    minuten: 35,
    portionen: 2,
    geraete: ["ofen"],
    kost: "vegetarisch", genuss: true,
    kcal: 390,
    protein_g: 16,
    zutaten: [
      { key: "paprika", menge: 2, einheit: "stueck" },
      { key: "zucchini", menge: 1, einheit: "stueck" },
      { key: "zwiebel", menge: 1, einheit: "stueck" },
      { key: "feta", menge: 150, einheit: "g" },
    ],
    schritte: [
      "Ofen auf 200 °C vorheizen.",
      "Gemüse in grobe Stücke schneiden, mit Öl, Salz und Pfeffer auf einem Blech mischen.",
      "20 Minuten backen, Feta darüberbröseln und weitere 10 Minuten backen.",
    ],
  },
  {
    slug: "lachs-brokkoli-reis",
    name: "Lachs mit Brokkoli und Reis",
    minuten: 25,
    portionen: 2,
    geraete: ["herd"],
    kost: "alles",
    kcal: 600,
    protein_g: 36,
    zutaten: [
      { key: "lachs", menge: 250, einheit: "g" },
      { key: "brokkoli", menge: 300, einheit: "g" },
      { key: "reis", menge: 150, einheit: "g" },
      { key: "zitrone", optional: true },
    ],
    schritte: [
      "Reis nach Packungsangabe kochen.",
      "Brokkoli in Röschen teilen und in wenig Salzwasser 5 Minuten garen.",
      "Lachs salzen und in etwas Öl von jeder Seite 3 bis 4 Minuten braten.",
      "Zusammen anrichten, nach Wunsch mit Zitrone beträufeln.",
    ],
  },
  {
    slug: "airfryer-suesskartoffel-kichererbsen",
    name: "Süßkartoffel und Kichererbsen aus dem Airfryer",
    minuten: 25,
    portionen: 2,
    geraete: ["airfryer"],
    kost: "vegan",
    kcal: 410,
    protein_g: 14,
    zutaten: [
      { key: "suesskartoffel", menge: 400, einheit: "g" },
      { key: "kichererbsen", menge: 1, einheit: "dose" },
    ],
    schritte: [
      "Süßkartoffel in Würfel schneiden, Kichererbsen abgießen und abtropfen lassen.",
      "Beides mit etwas Öl, Salz und Pfeffer mischen.",
      "Bei 190 °C etwa 18 Minuten im Airfryer garen und zwischendurch schütteln.",
    ],
  },
  {
    slug: "thunfisch-wrap",
    name: "Thunfisch-Wrap",
    minuten: 10,
    portionen: 2,
    geraete: [],
    kost: "alles",
    kcal: 380,
    protein_g: 26,
    zutaten: [
      { key: "wrap", menge: 2, einheit: "stueck" },
      { key: "thunfisch", menge: 1, einheit: "dose" },
      { key: "salat" },
      { key: "mais", optional: true },
      { key: "joghurt", optional: true },
    ],
    schritte: [
      "Thunfisch abtropfen lassen und nach Wunsch mit etwas Joghurt, Salz und Pfeffer mischen.",
      "Wraps mit Salat, Thunfisch und Mais belegen.",
      "Seiten einschlagen und fest aufrollen.",
    ],
  },
  {
    slug: "haehnchen-wrap",
    name: "Hähnchen-Wrap",
    minuten: 20,
    portionen: 2,
    geraete: ["herd"],
    kost: "alles", genuss: true,
    kcal: 460,
    protein_g: 36,
    zutaten: [
      { key: "wrap", menge: 2, einheit: "stueck" },
      { key: "haehnchenbrust", menge: 250, einheit: "g" },
      { key: "salat" },
      { key: "tomate", menge: 1, einheit: "stueck" },
      { key: "joghurt", optional: true },
    ],
    schritte: [
      "Hähnchen in Streifen schneiden, würzen und in etwas Öl durchbraten.",
      "Tomate würfeln, Salat zerkleinern.",
      "Wraps mit Salat, Tomate, Hähnchen und nach Wunsch Joghurt belegen und aufrollen.",
    ],
  },
  {
    slug: "linsen-curry",
    name: "Rotes Linsen-Curry mit Reis",
    minuten: 30,
    portionen: 3,
    geraete: ["herd"],
    kost: "vegan", genuss: true,
    kcal: 560,
    protein_g: 22,
    zutaten: [
      { key: "linsen", menge: 200, einheit: "g" },
      { key: "kokosmilch", menge: 1, einheit: "dose" },
      { key: "zwiebel", menge: 1, einheit: "stueck" },
      { key: "currypaste" },
      { key: "reis", menge: 150, einheit: "g" },
    ],
    schritte: [
      "Reis nach Packungsangabe kochen.",
      "Zwiebel würfeln und in Öl anbraten, Currypaste kurz mitrösten.",
      "Linsen, Kokosmilch und eine Dose Wasser dazugeben und 15 Minuten köcheln lassen.",
      "Mit Salz abschmecken und mit dem Reis servieren.",
    ],
  },
  {
    slug: "chili-sin-carne",
    name: "Chili sin Carne",
    minuten: 30,
    portionen: 3,
    geraete: ["herd"],
    kost: "vegan",
    kcal: 340,
    protein_g: 17,
    zutaten: [
      { key: "kidneybohnen", menge: 1, einheit: "dose" },
      { key: "mais", menge: 1, einheit: "dose" },
      { key: "passierte_tomaten", menge: 400, einheit: "g" },
      { key: "zwiebel", menge: 1, einheit: "stueck" },
      { key: "paprika", menge: 1, einheit: "stueck" },
    ],
    schritte: [
      "Zwiebel und Paprika würfeln und in Öl anbraten.",
      "Passierte Tomaten, abgetropfte Bohnen und Mais dazugeben.",
      "20 Minuten köcheln lassen und mit Salz und Pfeffer abschmecken.",
    ],
  },
  {
    slug: "chili-con-carne",
    name: "Chili con Carne",
    minuten: 35,
    portionen: 3,
    geraete: ["herd"],
    kost: "alles", genuss: true,
    kcal: 520,
    protein_g: 33,
    zutaten: [
      { key: "hackfleisch", menge: 300, einheit: "g" },
      { key: "kidneybohnen", menge: 1, einheit: "dose" },
      { key: "mais", menge: 1, einheit: "dose" },
      { key: "passierte_tomaten", menge: 400, einheit: "g" },
      { key: "zwiebel", menge: 1, einheit: "stueck" },
    ],
    schritte: [
      "Zwiebel würfeln und in Öl anbraten, Hackfleisch dazugeben und krümelig braten.",
      "Passierte Tomaten, abgetropfte Bohnen und Mais dazugeben.",
      "25 Minuten köcheln lassen und mit Salz und Pfeffer abschmecken.",
    ],
  },
  {
    slug: "tofu-gemuese-pfanne",
    name: "Tofu-Gemüse-Pfanne mit Reis",
    minuten: 20,
    portionen: 2,
    geraete: ["herd"],
    kost: "vegan",
    kcal: 500,
    protein_g: 26,
    zutaten: [
      { key: "tofu", menge: 200, einheit: "g" },
      { key: "gemuesemischung", menge: 300, einheit: "g" },
      { key: "reis", menge: 150, einheit: "g" },
      { key: "sojasauce" },
    ],
    schritte: [
      "Reis nach Packungsangabe kochen.",
      "Tofu würfeln und in Öl rundum knusprig braten.",
      "Gemüse dazugeben und einige Minuten mitbraten.",
      "Mit Sojasauce abschmecken und mit dem Reis servieren.",
    ],
  },
  {
    slug: "ueberbackenes-brot",
    name: "Überbackenes Brot mit Schinken und Käse",
    minuten: 15,
    portionen: 2,
    geraete: ["ofen"],
    kost: "alles", genuss: true,
    kcal: 430,
    protein_g: 24,
    zutaten: [
      { key: "brot", menge: 4, einheit: "stueck" },
      { key: "schinken", menge: 4, einheit: "stueck" },
      { key: "kaese", menge: 100, einheit: "g" },
      { key: "tomate", optional: true },
    ],
    schritte: [
      "Ofen auf 200 °C vorheizen.",
      "Brot mit Schinken, nach Wunsch Tomatenscheiben und Käse belegen.",
      "Etwa 8 Minuten backen, bis der Käse geschmolzen ist.",
    ],
  },
  {
    slug: "mikrowellen-kartoffel-huettenkaese",
    name: "Kartoffeln aus der Mikrowelle mit Hüttenkäse",
    minuten: 12,
    portionen: 1,
    geraete: ["mikrowelle"],
    kost: "vegetarisch",
    kcal: 430,
    protein_g: 30,
    zutaten: [
      { key: "kartoffel", menge: 400, einheit: "g" },
      { key: "huettenkaese", menge: 200, einheit: "g" },
    ],
    schritte: [
      "Kartoffeln waschen und mehrmals mit einer Gabel einstechen.",
      "In einer abgedeckten Schale 8 bis 10 Minuten bei hoher Stufe garen, bis sie weich sind.",
      "Aufschneiden, salzen und mit Hüttenkäse füllen.",
    ],
  },
  {
    slug: "bananen-pfannkuchen",
    name: "Bananen-Pfannkuchen",
    minuten: 15,
    portionen: 1,
    geraete: ["herd"],
    kost: "vegetarisch",
    kcal: 380,
    protein_g: 20,
    zutaten: [
      { key: "ei", menge: 2, einheit: "stueck" },
      { key: "banane", menge: 1, einheit: "stueck" },
      { key: "haferflocken", menge: 40, einheit: "g" },
      { key: "proteinpulver", optional: true },
    ],
    schritte: [
      "Banane mit einer Gabel zerdrücken und mit Eiern und Haferflocken verrühren.",
      "In einer Pfanne mit wenig Öl kleine Pfannkuchen ausbacken.",
      "Wenden, sobald die Unterseite fest ist, und fertig backen.",
    ],
  },
  {
    slug: "beeren-shake",
    name: "Beeren-Shake mit Proteinpulver",
    minuten: 5,
    portionen: 1,
    geraete: ["mixer"],
    kost: "vegetarisch",
    kcal: 390,
    protein_g: 35,
    zutaten: [
      { key: "beeren", menge: 150, einheit: "g" },
      { key: "banane", menge: 1, einheit: "stueck" },
      { key: "milch", menge: 300, einheit: "ml" },
      { key: "proteinpulver", menge: 30, einheit: "g" },
    ],
    schritte: [
      "Alle Zutaten in den Mixer geben.",
      "Etwa 30 Sekunden mixen, bis alles glatt ist.",
    ],
  },
  {
    slug: "nudeln-pesto-tomaten",
    name: "Nudeln mit Pesto und Tomaten",
    minuten: 15,
    portionen: 2,
    geraete: ["herd"],
    kost: "vegetarisch", genuss: true,
    kcal: 560,
    protein_g: 17,
    zutaten: [
      { key: "nudeln", menge: 200, einheit: "g" },
      { key: "pesto" },
      { key: "tomate", menge: 2, einheit: "stueck" },
      { key: "parmesan", optional: true },
    ],
    schritte: [
      "Nudeln in Salzwasser bissfest kochen.",
      "Tomaten würfeln.",
      "Nudeln abgießen, mit Pesto und Tomaten mischen und nach Wunsch Parmesan darüberreiben.",
    ],
  },
  {
    slug: "bratkartoffeln-ei-speck",
    name: "Bratkartoffeln mit Ei und Speck",
    minuten: 30,
    portionen: 2,
    geraete: ["herd"],
    kost: "alles", genuss: true,
    kcal: 680,
    protein_g: 27,
    zutaten: [
      { key: "kartoffel", menge: 500, einheit: "g" },
      { key: "ei", menge: 3, einheit: "stueck" },
      { key: "speck", menge: 100, einheit: "g" },
      { key: "zwiebel", menge: 1, einheit: "stueck" },
    ],
    schritte: [
      "Kartoffeln in dünne Scheiben schneiden und in Öl goldbraun braten.",
      "Speck und gewürfelte Zwiebel dazugeben und mitbraten.",
      "Eier darüberschlagen und stocken lassen, mit Salz und Pfeffer würzen.",
    ],
  },
  {
    slug: "couscous-salat-feta",
    name: "Couscous-Salat mit Feta",
    minuten: 15,
    portionen: 2,
    geraete: ["wasserkocher"],
    kost: "vegetarisch",
    kcal: 450,
    protein_g: 17,
    zutaten: [
      { key: "couscous", menge: 150, einheit: "g" },
      { key: "gurke", menge: 1, einheit: "stueck" },
      { key: "tomate", menge: 2, einheit: "stueck" },
      { key: "feta", menge: 100, einheit: "g" },
      { key: "zitrone", optional: true },
    ],
    schritte: [
      "Couscous mit der gleichen Menge kochendem Wasser übergießen und 5 Minuten quellen lassen.",
      "Gurke und Tomaten würfeln, Feta zerbröseln.",
      "Alles mischen, mit Öl, Salz, Pfeffer und nach Wunsch Zitrone abschmecken.",
    ],
  },
  {
    slug: "kartoffel-karotten-suppe",
    name: "Kartoffel-Karotten-Suppe",
    minuten: 30,
    portionen: 3,
    geraete: ["herd", "puerierstab"],
    kost: "vegan",
    kcal: 220,
    protein_g: 5,
    zutaten: [
      { key: "kartoffel", menge: 400, einheit: "g" },
      { key: "karotte", menge: 300, einheit: "g" },
      { key: "zwiebel", menge: 1, einheit: "stueck" },
      { key: "gemuesebruehe" },
    ],
    schritte: [
      "Zwiebel würfeln und in Öl anbraten.",
      "Kartoffeln und Karotten in Stücke schneiden, dazugeben und mit Brühe bedecken.",
      "20 Minuten köcheln lassen, bis alles weich ist.",
      "Mit dem Pürierstab fein pürieren und abschmecken.",
    ],
  },
  {
    slug: "avocado-brot-ei",
    name: "Avocado-Brot mit Ei",
    minuten: 10,
    portionen: 1,
    geraete: ["herd"],
    kost: "vegetarisch",
    kcal: 480,
    protein_g: 21,
    zutaten: [
      { key: "brot", menge: 2, einheit: "stueck" },
      { key: "avocado", menge: 1, einheit: "stueck" },
      { key: "ei", menge: 2, einheit: "stueck" },
    ],
    schritte: [
      "Eier in etwas Öl als Spiegelei braten.",
      "Avocado zerdrücken, salzen und auf das Brot streichen.",
      "Eier daraufsetzen und mit Pfeffer würzen.",
    ],
  },
];

export const REZEPTE: Rezept[] = [...EIGENE, ...BASED_REZEPTE];
