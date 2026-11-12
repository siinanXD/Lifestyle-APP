// Zutatenliste für Smart Cooking (SIN-1625): Schlüssel, Name und andere Schreibweisen.
// Rezepte nennen Schlüssel; der Vorrat ordnet freien Text (von Hand, später vom Kassenbon) einem Schlüssel zu.
// `grund`: Grundzutat, gilt beim Rezeptvorschlag immer als vorhanden.
type Zutat = { name: string; auch?: string[]; grund?: true };

export const ZUTATEN = {
  salz: { name: "Salz", grund: true },
  pfeffer: { name: "Pfeffer", grund: true },
  oel: { name: "Öl", auch: ["Olivenöl", "Rapsöl", "Sonnenblumenöl", "Speiseöl", "Bratöl"], grund: true },
  wasser: { name: "Wasser", auch: ["Leitungswasser"], grund: true },

  ei: { name: "Eier", auch: ["Ei", "Freilandeier", "Bio-Eier"] },
  haehnchenbrust: { name: "Hähnchenbrust", auch: ["Hähnchenbrustfilet", "Hähnchenfilet", "Hähnchen", "Hühnerbrust", "Hähnchen-Innenfilet"] },
  hackfleisch: { name: "Hackfleisch", auch: ["Rinderhack", "Rinderhackfleisch", "Hack", "Gehacktes", "Hackfleisch gemischt"] },
  lachs: { name: "Lachs", auch: ["Lachsfilet", "Stremellachs"] },
  thunfisch: { name: "Thunfisch", auch: ["Thunfischfilets", "Thunfisch in eigenem Saft"] },
  tofu: { name: "Tofu", auch: ["Naturtofu", "Räuchertofu"] },
  kichererbsen: { name: "Kichererbsen" },
  kidneybohnen: { name: "Kidneybohnen", auch: ["Bohnen", "rote Bohnen"] },
  linsen: { name: "Linsen", auch: ["rote Linsen", "Tellerlinsen"] },
  magerquark: { name: "Magerquark", auch: ["Quark", "Speisequark"] },
  skyr: { name: "Skyr" },
  joghurt: { name: "Joghurt", auch: ["Naturjoghurt", "griechischer Joghurt"] },
  huettenkaese: { name: "Hüttenkäse", auch: ["körniger Frischkäse"] },
  kaese: { name: "Käse", auch: ["Gouda", "Reibekäse", "geriebener Käse", "Emmentaler", "Streukäse", "Käsescheiben"] },
  mozzarella: { name: "Mozzarella" },
  feta: { name: "Feta", auch: ["Hirtenkäse", "Schafskäse"] },
  parmesan: { name: "Parmesan", auch: ["Grana Padano", "Pecorino"] },
  schinken: { name: "Schinken", auch: ["Kochschinken", "Putenbrust Aufschnitt"] },
  speck: { name: "Speck", auch: ["Bacon", "Speckwürfel"] },

  milch: { name: "Milch", auch: ["Vollmilch", "fettarme Milch", "H-Milch"] },
  haferdrink: { name: "Haferdrink", auch: ["Hafermilch", "Pflanzendrink", "Sojadrink", "Mandeldrink"] },
  butter: { name: "Butter", auch: ["Margarine"] },
  sahne: { name: "Sahne", auch: ["Kochsahne", "Schlagsahne"] },
  frischkaese: { name: "Frischkäse" },

  reis: { name: "Reis", auch: ["Basmatireis", "Langkornreis", "Jasminreis"] },
  nudeln: { name: "Nudeln", auch: ["Pasta", "Spaghetti", "Penne", "Fusilli", "Vollkornnudeln"] },
  kartoffel: { name: "Kartoffeln", auch: ["Kartoffel", "Speisekartoffeln"] },
  suesskartoffel: { name: "Süßkartoffeln", auch: ["Süßkartoffel"] },
  brot: { name: "Brot", auch: ["Vollkornbrot", "Toast", "Toastbrot", "Brötchen"] },
  wrap: { name: "Wraps", auch: ["Wrap", "Tortilla", "Tortillas", "Weizentortillas"] },
  haferflocken: { name: "Haferflocken" },
  mehl: { name: "Mehl", auch: ["Weizenmehl", "Dinkelmehl"] },
  couscous: { name: "Couscous" },
  pommes: { name: "Pommes", auch: ["Pommes frites", "Backofenpommes"] },

  zwiebel: { name: "Zwiebeln", auch: ["Zwiebel", "rote Zwiebeln"] },
  knoblauch: { name: "Knoblauch", auch: ["Knoblauchzehe"] },
  tomate: { name: "Tomaten", auch: ["Tomate", "Cherrytomaten", "Rispentomaten"] },
  passierte_tomaten: { name: "Passierte Tomaten", auch: ["gehackte Tomaten", "Dosentomaten", "Tomatensoße", "stückige Tomaten"] },
  paprika: { name: "Paprika", auch: ["Paprikaschote", "Paprika rot"] },
  gurke: { name: "Gurke", auch: ["Salatgurke", "Gurken"] },
  zucchini: { name: "Zucchini" },
  brokkoli: { name: "Brokkoli", auch: ["Broccoli"] },
  spinat: { name: "Spinat", auch: ["Blattspinat", "Babyspinat"] },
  karotte: { name: "Karotten", auch: ["Karotte", "Möhre", "Möhren"] },
  champignons: { name: "Champignons", auch: ["Pilze", "Champignon"] },
  mais: { name: "Mais", auch: ["Gemüsemais"] },
  erbsen: { name: "Erbsen" },
  salat: { name: "Salat", auch: ["Eisbergsalat", "Blattsalat", "Rucola", "Kopfsalat"] },
  avocado: { name: "Avocado" },
  gemuesemischung: { name: "Gemüsemischung", auch: ["Pfannengemüse", "TK-Gemüse", "Wokgemüse"] },

  banane: { name: "Bananen", auch: ["Banane"] },
  apfel: { name: "Äpfel", auch: ["Apfel"] },
  beeren: { name: "Beeren", auch: ["Heidelbeeren", "Himbeeren", "Erdbeeren", "Beerenmischung"] },
  zitrone: { name: "Zitrone", auch: ["Zitronen", "Zitronensaft", "Limette"] },

  honig: { name: "Honig", auch: ["Ahornsirup", "Agavendicksaft"] },
  erdnussbutter: { name: "Erdnussbutter", auch: ["Erdnussmus"] },
  nuesse: { name: "Nüsse", auch: ["Walnüsse", "Mandeln", "Cashews", "Nussmischung"] },
  sojasauce: { name: "Sojasauce", auch: ["Sojasoße"] },
  gemuesebruehe: { name: "Gemüsebrühe", auch: ["Brühe", "Brühwürfel"] },
  tomatenmark: { name: "Tomatenmark" },
  senf: { name: "Senf" },
  kokosmilch: { name: "Kokosmilch" },
  currypaste: { name: "Currypaste", auch: ["Currypulver", "Curry"] },
  proteinpulver: { name: "Proteinpulver", auch: ["Whey", "Eiweißpulver"] },
  pesto: { name: "Pesto" },
  zucker: { name: "Zucker" },
  backpulver: { name: "Backpulver" },

  // Für die Rezepte aus based.cooking dazugekommen.
  haehnchenschenkel: { name: "Hähnchenschenkel", auch: ["Hähnchenkeulen", "Hähnchenunterschenkel", "Hähnchenoberschenkel"] },
  schnitzelfleisch: { name: "Schnitzelfleisch", auch: ["Kalbsschnitzel", "Schweineschnitzel", "Schnitzel", "Putenschnitzel"] },
  bratwurst: { name: "Bratwurst", auch: ["Bratwürste", "Salsiccia", "grobe Bratwurst"] },
  fleischwurst: { name: "Fleischwurst", auch: ["Lyoner", "Falukorv", "Wiener Würstchen", "Würstchen"] },
  mayonnaise: { name: "Mayonnaise", auch: ["Mayo", "Salatmayonnaise"] },
  bechamel: { name: "Béchamelsauce", auch: ["Bechamelsauce", "Bechamel", "helle Sauce"] },
  lauch: { name: "Lauch", auch: ["Porree"] },
  fruehlingszwiebel: { name: "Frühlingszwiebeln", auch: ["Frühlingszwiebel", "Lauchzwiebeln", "Lauchzwiebel"] },
  ingwer: { name: "Ingwer" },
  chili: { name: "Chili", auch: ["Chilischote", "Chiliflocken", "Peperoni"] },
  gewuerzgurke: { name: "Gewürzgurken", auch: ["Gewürzgurke", "Cornichons", "Essiggurken", "saure Gurken"] },
  apfelmus: { name: "Apfelmus", auch: ["Apfelmark"] },
  tahini: { name: "Tahini", auch: ["Tahin", "Sesammus", "Sesampaste"] },
  paniermehl: { name: "Paniermehl", auch: ["Semmelbrösel"] },
  natron: { name: "Natron", auch: ["Backnatron"] },
  weisswein: { name: "Weißwein" },
  rotwein: { name: "Rotwein" },
  oregano: { name: "Oregano" },
  paprikapulver: { name: "Paprikapulver", auch: ["Paprika edelsüß", "Paprikagewürz"] },
  zimt: { name: "Zimt" },
  kreuzkuemmel: { name: "Kreuzkümmel", auch: ["Cumin"] },
  garam_masala: { name: "Garam Masala" },
} as const satisfies Record<string, Zutat>;

export type ZutatKey = keyof typeof ZUTATEN;
export const istZutat = (text: string): text is ZutatKey => text in ZUTATEN;
export const zutatName = (key: string) => (istZutat(key) ? ZUTATEN[key].name : key);
export const istGrundzutat = (key: string) => istZutat(key) && "grund" in ZUTATEN[key];
/** Namen für die Vorschlagsliste beim Eintragen, alphabetisch. */
export const ZUTATNAMEN = Object.values(ZUTATEN).map((z) => z.name).sort((a, b) => a.localeCompare(b, "de"));

const klein = (text: string) => text.toLocaleLowerCase("de-DE").replace(/ß/g, "ss");
const woerter = (text: string) => klein(text).split(/[^a-zäöü]+/).filter(Boolean);
// Mehrzahl und Beugung grob abschneiden: „Tomaten“ und „Tomate“ treffen sich bei „tomat“, „Eier“ und „Ei“ bei „ei“.
const stamm = (wort: string) => (wort.length > 3 ? wort.replace(/(en|er|n|e|s)$/, "") : wort);

type Muster = { key: ZutatKey; woerter: string[] };
// Längste Schreibweise zuerst: „Passierte Tomaten“ schlägt „Tomaten“, „Süßkartoffel“ schlägt „Kartoffel“.
const MUSTER: Muster[] = (Object.entries(ZUTATEN) as [ZutatKey, Zutat][])
  .flatMap(([key, z]) => [z.name, ...(z.auch ?? [])].map((schreibweise) => ({ key, woerter: woerter(schreibweise).map(stamm) })))
  .sort((a, b) => b.woerter.length - a.woerter.length || b.woerter.join("").length - a.woerter.join("").length);

/**
 * Ordnet freien Text einer Zutat zu: „Bio Eier 10er“ → ei, „rote Paprika“ → paprika. Ganze Wörter müssen passen
 * („Kokosmilch“ ist keine „Milch“). Unbekannt → null; der Eintrag bleibt dann im Vorrat, zählt aber für Rezepte nicht.
 */
export function ordneZu(text: string): ZutatKey | null {
  const staemme = woerter(text).map(stamm);
  if (staemme.length === 0) return null;
  const treffer = MUSTER.find((m) => staemme.some((_, i) => m.woerter.every((w, j) => staemme[i + j] === w)));
  return treffer?.key ?? null;
}
