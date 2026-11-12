import type { Rezept } from "./rezepte";

// Rezepte aus https://github.com/LukeSmithxyz/based.cooking (Unlicense, gemeinfrei), Stand 19.10.2026.
// Ins Deutsche übertragen, gekürzt und auf die Zutaten- und Geräteschlüssel der App abgebildet. Die Bilder liegen
// verkleinert in public/rezepte/<slug>.webp. Nährwerte stehen nicht in der Quelle: von Hand geschätzt, je Portion.
const Z = (key: Rezept["zutaten"][number]["key"], menge?: number, einheit?: Rezept["zutaten"][number]["einheit"], optional?: true) => ({
  key,
  ...(menge === undefined ? {} : { menge }),
  ...(einheit ? { einheit } : {}),
  ...(optional ? { optional } : {}),
});
const based = (r: Omit<Rezept, "bild" | "quelle">): Rezept => ({ ...r, bild: `/rezepte/${r.slug}.webp`, quelle: "based.cooking" });

export const BASED_REZEPTE: Rezept[] = [
  based({
    slug: "aelplermagronen", name: "Älplermagronen", minuten: 35, portionen: 4, geraete: ["herd"], kost: "alles", genuss: true, kcal: 780, protein_g: 30,
    zutaten: [Z("speck", 150, "g"), Z("zwiebel", 3, "stueck"), Z("kartoffel", 400, "g"), Z("milch", 1, "l"), Z("nudeln", 400, "g"), Z("kaese", 150, "g"), Z("apfelmus", 1, "glas")],
    schritte: [
      "Speckwürfel in einem großen Topf anbraten. Zwiebeln in halbe Ringe schneiden und im selben Topf glasig dünsten.",
      "Kartoffeln schälen, in 1 cm große Würfel schneiden und dazugeben. Mit einem Teil der Milch bedecken und etwa 10 Minuten kochen.",
      "Nudeln und die restliche Milch dazugeben, bis alles bedeckt ist. Die Nudeln saugen die meiste Milch auf.",
      "Käse reiben und kurz vor Ende der Garzeit unterrühren. Es darf im Topf noch etwas flüssig wirken, beim Abkühlen wird es fester.",
      "Kräftig salzen, nach Wunsch mit Muskat würzen und mit Apfelmus servieren.",
    ],
  }),
  based({
    slug: "arroz-chaufa", name: "Gebratener Reis mit Hähnchen und Ei (Arroz Chaufa)", minuten: 50, portionen: 4, geraete: ["herd"], kost: "alles", kcal: 520, protein_g: 32,
    zutaten: [Z("reis", 300, "g"), Z("haehnchenbrust", 400, "g"), Z("ei", 3, "stueck"), Z("paprika", 1, "stueck"), Z("fruehlingszwiebel", 1, "bund"), Z("sojasauce"), Z("speck", undefined, undefined, true)],
    schritte: [
      "Reis kochen. Reis vom Vortag geht am besten.",
      "Hähnchen in Stücke schneiden, salzen und braten. Eier als Rührei braten und salzen.",
      "Frühlingszwiebeln und Paprika in kleine Würfel schneiden.",
      "Alles bei schwacher Hitze mischen und mit Sojasauce abschmecken.",
    ],
  }),
  based({
    slug: "baked-pasta-with-broccoli", name: "Nudelauflauf mit Brokkoli", minuten: 45, portionen: 4, geraete: ["herd", "ofen"], kost: "vegetarisch", kcal: 760, protein_g: 36,
    zutaten: [Z("nudeln", 500, "g"), Z("brokkoli", 500, "g"), Z("ei", 4, "stueck"), Z("mozzarella", 200, "g"), Z("bechamel", 400, "g"), Z("parmesan", undefined, undefined, true)],
    schritte: [
      "Nudeln in Salzwasser kochen. Brokkoli und Eier 10 Minuten kochen.",
      "Mozzarella würfeln. Eine Auflaufform bereitstellen.",
      "Abwechselnd schichten: Béchamelsauce, Nudeln, Brokkoli, Käsewürfel, Salz und Pfeffer. Wiederholen, bis alles verbraucht ist.",
      "Im vorgeheizten Ofen bei 180 °C 15 bis 20 Minuten backen, zum Schluss 5 bis 10 Minuten mit Grillfunktion bräunen.",
    ],
  }),
  based({
    slug: "banana-oatmeal-cookies", name: "Bananen-Hafer-Kekse", minuten: 25, portionen: 3, geraete: ["ofen"], kost: "vegan", kcal: 200, protein_g: 5,
    zutaten: [Z("banane", 2, "stueck"), Z("haferflocken", 100, "g"), Z("zimt", undefined, undefined, true)],
    schritte: [
      "Ofen auf 180 °C vorheizen.",
      "Reife Bananen schälen und in einer Schüssel grob zerdrücken. Haferflocken und nach Wunsch Zimt untermischen.",
      "Aus der Masse etwa 8 cm große Taler auf ein Blech mit Backpapier setzen.",
      "Etwa 20 Minuten mit Umluft backen, bis die Kekse außen goldbraun und leicht knusprig sind.",
    ],
  }),
  based({
    slug: "blueberry-smoothie", name: "Heidelbeer-Smoothie", minuten: 5, portionen: 2, geraete: ["mixer"], kost: "vegetarisch", kcal: 190, protein_g: 9,
    zutaten: [Z("beeren", 150, "g"), Z("milch", 250, "ml"), Z("joghurt", 125, "g"), Z("honig", undefined, undefined, true), Z("haferflocken", undefined, undefined, true)],
    schritte: ["Beeren, Milch und Joghurt in den Mixer geben, nach Wunsch Honig und Haferflocken dazu.", "Etwa 10 Sekunden mixen und sofort trinken."],
  }),
  based({
    slug: "butter-chicken-masala", name: "Butter Chicken Masala", minuten: 60, portionen: 2, geraete: ["herd", "ofen"], kost: "alles", genuss: true, kcal: 520, protein_g: 30,
    zutaten: [Z("haehnchenbrust", 230, "g"), Z("butter", 30, "g"), Z("zwiebel", 2, "stueck"), Z("tomate", 2, "stueck"), Z("zitrone", 1, "stueck"), Z("knoblauch", 3, "stueck"), Z("ingwer", 15, "g"), Z("garam_masala"), Z("sahne", 60, "ml"), Z("chili", undefined, undefined, true)],
    schritte: [
      "Hähnchen würfeln und mit Salz, Pfeffer, der Hälfte von Ingwer und Knoblauch, etwas Chili und Zitronensaft mischen. Eine Stunde ziehen lassen, wenn die Zeit da ist.",
      "Das Hähnchen 5 bis 10 Minuten bei mittlerer Hitze im Ofen vorgaren, bis es zu drei Vierteln durch ist.",
      "Butter in einer Pfanne erhitzen und die fein gehackten Zwiebeln glasig braten. Restlichen Knoblauch und Ingwer kurz mitbraten, dann Garam Masala dazugeben.",
      "Tomaten pürieren und mit Salz dazugeben. Etwa 5 Minuten köcheln, bis die Sauce eindickt.",
      "Hähnchen und Sahne dazugeben und 5 bis 10 Minuten fertig garen. Mit Reis oder Fladenbrot servieren.",
    ],
  }),
  based({
    slug: "cacio-e-pepe", name: "Spaghetti Cacio e Pepe", minuten: 20, portionen: 2, geraete: ["herd"], kost: "vegetarisch", genuss: true, kcal: 560, protein_g: 22,
    zutaten: [Z("nudeln", 200, "g"), Z("parmesan", 80, "g")],
    schritte: [
      "Spaghetti 3 bis 4 Minuten kürzer kochen als auf der Packung steht. Das Kochwasser aufheben.",
      "Pfefferkörner grob zerstoßen und die Hälfte bei mittlerer Hitze in einer Pfanne rösten.",
      "Nudeln mit 2 Löffeln Kochwasser in die Pfanne geben.",
      "Die Hälfte vom geriebenen Käse mit einem Löffel Kochwasser zu einer Creme rühren und unter die fast garen Nudeln mischen. Ist es zu trocken, mehr Wasser dazugeben.",
      "Mit dem restlichen Käse und Pfeffer servieren.",
    ],
  }),
  based({
    slug: "carbonara", name: "Spaghetti Carbonara", minuten: 30, portionen: 4, geraete: ["herd"], kost: "alles", genuss: true, kcal: 560, protein_g: 26,
    zutaten: [Z("nudeln", 320, "g"), Z("ei", 5, "stueck"), Z("speck", 150, "g"), Z("parmesan", 35, "g")],
    schritte: [
      "Die Eigelbe mit dem geriebenen Käse und etwas Pfeffer in einer Schüssel verrühren.",
      "Nudeln in schwach gesalzenem Wasser eine Minute kürzer kochen als angegeben.",
      "Speck bei schwacher bis mittlerer Hitze braten, bis er außen knusprig ist.",
      "Nudeln abgießen, eine Minute abkühlen lassen und in der Schüssel zügig mit der Eimasse mischen, dann den Speck dazugeben. Sind die Nudeln zu heiß, stockt das Ei.",
      "Mit Käse und Pfeffer servieren.",
    ],
  }),
  based({
    slug: "cheesy-ham-and-potato-bake", name: "Kartoffel-Schinken-Auflauf mit Käse", minuten: 120, portionen: 4, geraete: ["herd", "ofen"], kost: "alles", kcal: 640, protein_g: 32,
    zutaten: [Z("kartoffel", 1, "kg"), Z("schinken", 300, "g"), Z("zwiebel", 1, "stueck"), Z("kaese", 200, "g"), Z("sahne", 200, "ml")],
    schritte: [
      "Zwiebel hacken und in etwas Butter oder Öl glasig dünsten.",
      "Kartoffeln waschen und in dünne Scheiben schneiden, Schinken in Streifen.",
      "Kartoffeln in eine große Auflaufform geben, Schinken und Zwiebel darauf verteilen, Sahne darübergießen. Salzen und pfeffern.",
      "Käse darüberstreuen und bei 200 °C etwa 90 Minuten backen. Mit Alufolie abdecken, sobald der Käse Farbe hat.",
    ],
  }),
  based({
    slug: "chicken-pasta-casserole", name: "Hähnchen-Nudel-Auflauf", minuten: 40, portionen: 5, geraete: ["herd", "ofen"], kost: "alles", kcal: 640, protein_g: 55,
    zutaten: [Z("nudeln", 450, "g"), Z("haehnchenbrust", 700, "g"), Z("mozzarella", 250, "g"), Z("parmesan", 40, "g"), Z("paniermehl", 40, "g"), Z("passierte_tomaten", 450, "g"), Z("butter", 15, "g")],
    schritte: [
      "Ofen auf 200 °C vorheizen.",
      "Hähnchen würfeln und in Öl durchbraten. Nudeln 7 bis 8 Minuten kochen, also etwas kürzer als üblich.",
      "Hähnchen und Nudeln in einer Auflaufform mischen, Tomaten und geriebenen Mozzarella unterheben.",
      "Mit Parmesan und Paniermehl bestreuen, Butterflocken daraufsetzen und 22 bis 25 Minuten backen, bis die Kruste goldbraun ist.",
    ],
  }),
  based({
    slug: "croque-monsieur", name: "Croque Monsieur", minuten: 25, portionen: 6, geraete: ["herd", "ofen"], kost: "alles", genuss: true, kcal: 400, protein_g: 20,
    zutaten: [Z("butter", 50, "g"), Z("mehl", 50, "g"), Z("milch", 1, "l"), Z("brot", 12, "stueck"), Z("senf"), Z("schinken", 12, "stueck"), Z("kaese", 80, "g")],
    schritte: [
      "Für die Béchamelsauce Butter in einem Topf schmelzen, Mehl, Salz, Pfeffer und eine Prise Muskat einrühren.",
      "Die Milch nach und nach unter Rühren dazugießen, bis die Sauce eindickt.",
      "Ofen auf 180 °C heizen. Sechs Brotscheiben mit Senf bestreichen, dann Sauce, Schinken, Käse und noch einmal Sauce daraufgeben. Mit den übrigen Scheiben abdecken, dünn mit Sauce bestreichen und mit Käse bestreuen.",
      "Auf einem Blech etwa 10 Minuten backen, am Ende nach Wunsch 3 bis 4 Minuten unter den Grill.",
    ],
  }),
  based({
    slug: "fall-vegetable-and-chickpea-curry", name: "Gemüse-Kichererbsen-Curry", minuten: 40, portionen: 4, geraete: ["herd"], kost: "vegetarisch", kcal: 430, protein_g: 17,
    zutaten: [Z("butter", 15, "g"), Z("zwiebel", 1, "stueck"), Z("currypaste"), Z("ingwer", 15, "g"), Z("suesskartoffel", 1, "stueck"), Z("zucchini", 1, "stueck"), Z("paprika", 1, "stueck"), Z("kichererbsen", 2, "dose"), Z("zitrone", 1, "stueck"), Z("mehl", 25, "g"), Z("milch", 350, "ml")],
    schritte: [
      "Butter in einer großen Pfanne erhitzen und die gehackte Zwiebel 2 Minuten braten. Currypaste und Ingwer 1 Minute mitbraten.",
      "Süßkartoffel, Zucchini und Paprika in kleine Stücke schneiden und mit Salz und 120 ml Wasser dazugeben. Zugedeckt etwa 10 Minuten garen.",
      "Abgetropfte Kichererbsen, Schale und Saft der Limette oder Zitrone unterrühren und weitergaren, bis das Gemüse weich ist.",
      "Mehl in die Milch rühren, nach und nach in die Pfanne geben und 5 Minuten köcheln lassen. Mit Reis oder einem Löffel Joghurt servieren.",
    ],
  }),
  based({
    slug: "french-toast", name: "French Toast", minuten: 30, portionen: 1, geraete: ["herd"], kost: "vegetarisch", genuss: true, kcal: 620, protein_g: 26,
    zutaten: [Z("ei", 2, "stueck"), Z("milch", 120, "ml"), Z("brot", 5, "stueck"), Z("butter", 15, "g"), Z("honig", undefined, undefined, true)],
    schritte: [
      "Eier und Milch in einer Schüssel glatt verquirlen.",
      "Butter in einer Pfanne bei schwacher bis mittlerer Hitze schmelzen.",
      "Jede Brotscheibe von beiden Seiten kurz in die Eiermilch tauchen, abtropfen lassen und von beiden Seiten goldbraun braten.",
      "Nach Wunsch mit Ahornsirup oder Honig servieren.",
    ],
  }),
  based({
    slug: "hummus", name: "Hummus", minuten: 35, portionen: 4, geraete: ["herd", "kuechenmaschine"], kost: "vegan", kcal: 300, protein_g: 11,
    zutaten: [Z("kichererbsen", 1, "dose"), Z("tahini", 120, "g"), Z("zitrone", 2, "stueck"), Z("knoblauch", 1, "stueck"), Z("natron", undefined, undefined, true), Z("kreuzkuemmel", undefined, undefined, true)],
    schritte: [
      "Kichererbsen abspülen und mit einem Teelöffel Natron in Wasser 20 Minuten kochen, bis sich die Häutchen lösen. Abgießen und kalt abspülen.",
      "Knoblauch, Zitronensaft und eine Prise Salz in der Küchenmaschine fein zerkleinern. Tahini dazugeben und cremig mixen.",
      "Bei laufender Maschine zwei Esslöffel eiskaltes Wasser einlaufen lassen, bis die Masse heller und luftig wird.",
      "Kichererbsen und Kreuzkümmel dazugeben, einen Esslöffel Olivenöl langsam einlaufen lassen und 1 bis 3 Minuten glatt mixen.",
      "In einer Schale glatt streichen und mit Olivenöl beträufeln. Hält sich im Kühlschrank bis zu einer Woche.",
    ],
  }),
  based({
    slug: "korv-stroganoff", name: "Wurst-Stroganoff (Korv Stroganoff)", minuten: 25, portionen: 4, geraete: ["herd"], kost: "alles", kcal: 650, protein_g: 20,
    zutaten: [Z("fleischwurst", 500, "g"), Z("zwiebel", 1, "stueck"), Z("tomatenmark", 60, "g"), Z("sahne", 250, "ml"), Z("milch", 100, "ml"), Z("sojasauce"), Z("senf"), Z("reis", 300, "g", true)],
    schritte: [
      "Wurst in Stifte schneiden, Zwiebel würfeln.",
      "Beides etwa 10 Minuten in Öl braten. Tomatenmark dazugeben und eine Minute mitbraten.",
      "Sahne, Milch, einen Esslöffel Sojasauce und einen Esslöffel Senf einrühren und mindestens 5 Minuten köcheln lassen.",
      "Kräftig pfeffern, bei Bedarf salzen und mit gekochtem Reis servieren.",
    ],
  }),
  based({
    slug: "lemon-and-oregano-chicken-traybake", name: "Zitronen-Oregano-Hähnchen vom Blech", minuten: 90, portionen: 4, geraete: ["ofen"], kost: "alles", genuss: true, kcal: 720, protein_g: 48,
    zutaten: [Z("haehnchenschenkel", 8, "stueck"), Z("kartoffel", 500, "g"), Z("speck", 100, "g"), Z("zwiebel", 8, "stueck"), Z("oregano"), Z("zitrone", 2, "stueck"), Z("gemuesebruehe", 200, "ml"), Z("weisswein", 100, "ml")],
    schritte: [
      "Ofen auf 220 °C (Umluft 200 °C) heizen. Kartoffeln in dünne Scheiben schneiden, auf einem tiefen Blech mit Öl, Salz und Pfeffer mischen und in den Ofen schieben.",
      "Hähnchenschenkel würzen. Schalotten oder kleine Zwiebeln in Spalten, Zitronen in Viertel schneiden.",
      "Hähnchen, Zwiebeln, Zitronen, Speck und Oregano auf dem Blech verteilen, mit Öl beträufeln und weiterbacken.",
      "Zum Schluss Brühe und Weißwein darübergießen und noch 20 Minuten backen, bis das Hähnchen durch ist.",
    ],
  }),
  based({
    slug: "lenten-lentil-curry", name: "Linsen-Curry mit Fadennudeln", minuten: 40, portionen: 2, geraete: ["herd"], kost: "vegan", kcal: 440, protein_g: 27,
    zutaten: [Z("linsen", 200, "g"), Z("nudeln", 50, "g"), Z("currypaste"), Z("paprikapulver"), Z("zimt")],
    schritte: [
      "Linsen gründlich abspülen und in einem Liter Wasser 15 bis 20 Minuten leicht kochen. Abgießen.",
      "Fadennudeln, einen Teelöffel Currypulver, je einen halben Teelöffel Paprikapulver und Zimt, 1½ Teelöffel Salz und etwas Pfeffer dazugeben.",
      "Einen halben Liter kochendes Wasser angießen und etwa 10 Minuten köcheln lassen.",
    ],
  }),
  based({
    slug: "menemen", name: "Menemen (türkisches Rührei mit Tomaten)", minuten: 25, portionen: 3, geraete: ["herd"], kost: "vegetarisch", genuss: true, kcal: 230, protein_g: 11,
    zutaten: [Z("paprika", 4, "stueck"), Z("tomate", 4, "stueck"), Z("ei", 4, "stueck"), Z("zwiebel", 2, "stueck"), Z("butter", 20, "g"), Z("paprikapulver", undefined, undefined, true)],
    schritte: [
      "Tomaten ein paar Minuten in kochendes Wasser legen, häuten und in Stücke schneiden. Zwiebeln und Paprika klein schneiden.",
      "Butter in einer Pfanne schmelzen, Zwiebeln und Paprika mit etwas Salz braten, bis die Zwiebeln braun werden.",
      "Tomaten dazugeben und mit einem Löffel zerdrücken.",
      "Eier und Gewürze einrühren, Deckel auflegen und 2 bis 3 Minuten stocken lassen.",
    ],
  }),
  based({
    slug: "oatmeal-pancakes", name: "Hafer-Pfannkuchen", minuten: 40, portionen: 4, geraete: ["herd"], kost: "vegetarisch", kcal: 210, protein_g: 8,
    zutaten: [Z("ei", 2, "stueck"), Z("zucker", 40, "g"), Z("honig", 20, "g"), Z("milch", 60, "ml"), Z("haferflocken", 120, "g"), Z("backpulver")],
    schritte: [
      "Eier, Zucker, Honig und Milch verrühren.",
      "Haferflocken fein mahlen und mit einem Teelöffel Backpulver mischen. Beides zusammenrühren und den Teig 15 Minuten ruhen lassen.",
      "Pfanne bei schwacher Hitze 5 Minuten vorheizen. Kleine Pfannkuchen 1 bis 1½ Minuten backen, wenden, sobald Blasen aufsteigen, und noch etwa eine Minute backen.",
      "Mit Marmelade servieren.",
    ],
  }),
  based({
    slug: "overnight-oats", name: "Overnight Oats mit Banane und Erdnussbutter", minuten: 10, portionen: 3, geraete: ["mixer"], kost: "vegetarisch", kcal: 760, protein_g: 31,
    zutaten: [Z("milch", 700, "ml"), Z("banane", 3, "stueck"), Z("joghurt", 90, "g"), Z("erdnussbutter", 140, "g"), Z("haferflocken", 270, "g")],
    schritte: [
      "Milch und Bananenstücke im Mixer glatt mixen. Joghurt und Erdnussbutter dazugeben und noch einmal mixen.",
      "Auf drei verschließbare Behälter verteilen und die Haferflocken gründlich unterrühren, damit nichts klumpt.",
      "Mindestens 12 Stunden im Kühlschrank quellen lassen.",
    ],
  }),
  based({
    slug: "pancake", name: "Pfannkuchen", minuten: 30, portionen: 2, geraete: ["herd"], kost: "vegetarisch", kcal: 520, protein_g: 20,
    zutaten: [Z("mehl", 200, "g"), Z("milch", 200, "ml"), Z("ei", 2, "stueck"), Z("zucker", 10, "g"), Z("natron")],
    schritte: [
      "Mehl, Milch, Eier, Zucker, einen Teelöffel Natron und eine Prise Salz in einer Schüssel verrühren.",
      "Den Teig etwa 15 Minuten ruhen lassen.",
      "Pfanne mit etwas Butter oder Öl erhitzen. Je eine Kelle Teig bei mittlerer Hitze von beiden Seiten braun backen.",
      "Mit Sirup oder Zimt und Zucker servieren.",
    ],
  }),
  based({
    slug: "pasta-arrabbiata", name: "Pasta Arrabbiata", minuten: 25, portionen: 4, geraete: ["herd"], kost: "vegetarisch", kcal: 520, protein_g: 17,
    zutaten: [Z("nudeln", 500, "g"), Z("chili"), Z("knoblauch", 4, "stueck"), Z("passierte_tomaten", 800, "g"), Z("parmesan", undefined, undefined, true)],
    schritte: [
      "Nudelwasser aufsetzen. Ein paar Esslöffel Olivenöl bei schwacher Hitze erwärmen.",
      "Knoblauch hineinpressen, Chili dazugeben und kurz anbraten, ohne dass der Knoblauch verbrennt.",
      "Tomaten mit Salz und Pfeffer dazugeben und bei mittlerer Hitze 10 bis 15 Minuten einkochen.",
      "Nudeln in kräftig gesalzenem Wasser knapp gar kochen, abgießen und in der Sauce fertig ziehen lassen. Ist die Sauce zu dick, etwas Nudelwasser dazugeben.",
      "Mit gehackter Petersilie und geriebenem Käse servieren.",
    ],
  }),
  based({
    slug: "potato-leek-soup", name: "Kartoffel-Lauch-Suppe", minuten: 95, portionen: 2, geraete: ["herd", "puerierstab"], kost: "vegetarisch", kcal: 560, protein_g: 9,
    zutaten: [Z("butter", 40, "g"), Z("lauch", 2, "stueck"), Z("gemuesebruehe", 1, "l"), Z("kartoffel", 300, "g"), Z("sahne", 180, "ml")],
    schritte: [
      "Den weißen und hellgrünen Teil vom Lauch in Stücke schneiden. Kartoffeln schälen und in Scheiben schneiden.",
      "Butter in einem Topf bei schwacher bis mittlerer Hitze schmelzen, Lauch und Kartoffeln darin anschwitzen.",
      "Brühe, Pfeffer und nach Wunsch ein Lorbeerblatt und Muskat dazugeben. Köcheln lassen, bis die Kartoffeln weich sind.",
      "Vom Herd nehmen, das Lorbeerblatt entfernen und mit dem Pürierstab so fein pürieren, wie du es magst.",
      "Sahne einrühren und mit Salz abschmecken.",
    ],
  }),
  based({
    slug: "quesadilla", name: "Quesadilla", minuten: 10, portionen: 1, geraete: ["herd"], kost: "vegetarisch", kcal: 480, protein_g: 22,
    zutaten: [Z("wrap", 2, "stueck"), Z("kaese", 80, "g"), Z("kidneybohnen", undefined, undefined, true), Z("mais", undefined, undefined, true), Z("champignons", undefined, undefined, true)],
    schritte: [
      "Eine Pfanne auf mittlere Hitze bringen, nach Wunsch mit einem dünnen Ölfilm.",
      "Eine Tortilla hineinlegen und den Käse am Rand verteilen, damit die Füllung beim Wenden hält.",
      "Füllung nach Wahl daraufgeben, zum Beispiel Bohnen, Mais oder gebratene Pilze. Zuklappen oder die zweite Tortilla darauflegen.",
      "Mehrmals wenden, bis beide Seiten goldbraun sind.",
    ],
  }),
  based({
    slug: "roesti", name: "Rösti mit Spiegelei und Erbsen", minuten: 40, portionen: 4, geraete: ["herd"], kost: "vegetarisch", genuss: true, kcal: 430, protein_g: 17,
    zutaten: [Z("kartoffel", 800, "g"), Z("karotte", 2, "stueck"), Z("erbsen", 500, "g"), Z("ei", 4, "stueck"), Z("zwiebel", 2, "stueck"), Z("butter", 40, "g")],
    schritte: [
      "Rohe oder gekochte, abgekühlte Kartoffeln grob raspeln. Eine Zwiebel würfeln, untermischen und würzen.",
      "Butter in einer großen Pfanne erhitzen, die Masse bei starker Hitze ein paar Minuten unter Rühren erwärmen.",
      "Hitze etwas senken, zu einem 1 bis 1,5 cm dicken Fladen formen und Butterflocken am Rand dazugeben. 5 bis 10 Minuten braten, bis eine Kruste entsteht.",
      "Inzwischen die zweite Zwiebel und die Karotten würfeln und mit den Erbsen und etwas Wasser zugedeckt dünsten.",
      "Rösti mit Hilfe eines Tellers wenden und bei schwächerer Hitze fertig braten. Herausnehmen, Eier als Spiegelei braten und alles zusammen servieren.",
    ],
  }),
  based({
    slug: "schnitzel", name: "Wiener Schnitzel", minuten: 25, portionen: 4, geraete: ["herd"], kost: "alles", genuss: true, kcal: 560, protein_g: 40,
    zutaten: [Z("schnitzelfleisch", 600, "g"), Z("ei", 2, "stueck"), Z("zitrone", 1, "stueck"), Z("mehl", 100, "g"), Z("paniermehl", 150, "g"), Z("butter", 100, "g")],
    schritte: [
      "Drei Teller vorbereiten: Mehl, verquirlte Eier und Paniermehl mit Salz und Paprikapulver.",
      "Das Fleisch trocken tupfen und auf etwa einen halben Zentimeter flach klopfen. Von beiden Seiten salzen und pfeffern.",
      "Nacheinander in Mehl, Ei und Paniermehl wenden.",
      "Butter oder Butterschmalz in einer tiefen Pfanne schmelzen, ohne dass sie braun wird. Die Schnitzel von jeder Seite etwa 3 Minuten goldbraun braten.",
      "Mit einem Stück Zitrone servieren.",
    ],
  }),
  based({
    slug: "shakshouka", name: "Shakshuka", minuten: 20, portionen: 2, geraete: ["herd"], kost: "vegetarisch", kcal: 260, protein_g: 17,
    zutaten: [Z("tomate", 5, "stueck"), Z("ei", 5, "stueck"), Z("zwiebel", 1, "stueck"), Z("kreuzkuemmel", undefined, undefined, true), Z("paprikapulver", undefined, undefined, true)],
    schritte: [
      "Tomaten überbrühen, häuten und würfeln.",
      "Zwiebel hacken und in Öl glasig braten. Tomaten dazugeben, mit Salz, Kreuzkümmel und Paprikapulver würzen und einkochen lassen.",
      "Die Eier hineinschlagen, würzen und zugedeckt garen, bis sie gestockt sind.",
      "Nach Wunsch mit Schnittlauch bestreuen.",
    ],
  }),
  based({
    slug: "spaghetti-all-amatriciana", name: "Spaghetti all'Amatriciana", minuten: 30, portionen: 4, geraete: ["herd"], kost: "alles", genuss: true, kcal: 560, protein_g: 20,
    zutaten: [Z("nudeln", 350, "g"), Z("speck", 100, "g"), Z("passierte_tomaten", 300, "g"), Z("weisswein", 60, "ml"), Z("parmesan", 40, "g"), Z("chili")],
    schritte: [
      "Käse reiben, Chili fein hacken.",
      "Speck in dünne Streifen schneiden und mit dem Chili etwa 3 Minuten in Olivenöl bei mittlerer bis starker Hitze braten.",
      "Mit Weißwein ablöschen und einkochen, bis der Alkohol verdampft ist. Nudeln aufsetzen.",
      "Hitze senken, Tomaten, etwas Salz und reichlich Pfeffer dazugeben und etwa 15 Minuten köcheln.",
      "Nudeln abgießen, mit Sauce und Käse mischen und sofort servieren.",
    ],
  }),
  based({
    slug: "stracciatella-soup", name: "Stracciatella-Suppe (Eierflockensuppe)", minuten: 15, portionen: 1, geraete: ["herd"], kost: "vegetarisch", kcal: 190, protein_g: 14,
    zutaten: [Z("ei", 2, "stueck"), Z("gemuesebruehe", 500, "ml"), Z("brot", undefined, undefined, true)],
    schritte: [
      "Eier in einer Schüssel verquirlen. Brühe aufkochen.",
      "Die Eier in die kochende Brühe gießen und mit dem Schneebesen rühren, bis sie stocken.",
      "Nach Wunsch mit etwas Olivenöl beträufeln. Dazu passt geröstetes Brot.",
    ],
  }),
  based({
    slug: "tuna-salad", name: "Thunfischsalat", minuten: 5, portionen: 3, geraete: [], kost: "alles", kcal: 290, protein_g: 14,
    zutaten: [Z("thunfisch", 1, "dose"), Z("mayonnaise", 90, "g"), Z("gewuerzgurke", 1, "stueck"), Z("ei", undefined, undefined, true), Z("zitrone", undefined, undefined, true)],
    schritte: [
      "Thunfisch abtropfen lassen und mit Mayonnaise und fein gehackter Gewürzgurke verrühren.",
      "Nach Wunsch ein gehacktes hartgekochtes Ei, geriebenen Käse oder etwas Zitronensaft unterheben.",
      "Mit Salz, Pfeffer und einer Prise Knoblauchpulver abschmecken.",
    ],
  }),
  based({
    slug: "two-ingredient-pancakes", name: "Bananen-Ei-Pfannkuchen (2 Zutaten)", minuten: 20, portionen: 2, geraete: ["herd"], kost: "vegetarisch", kcal: 190, protein_g: 8,
    zutaten: [Z("banane", 2, "stueck"), Z("ei", 2, "stueck"), Z("haferflocken", undefined, undefined, true), Z("zimt", undefined, undefined, true), Z("beeren", undefined, undefined, true)],
    schritte: [
      "Eier verquirlen und die Bananen hineindrücken. Der Teig darf stückig bleiben.",
      "Nach Wunsch Haferflocken, Zimt oder Beeren unterrühren.",
      "Kleine Pfannkuchen bei mittlerer Hitze in der Pfanne backen.",
    ],
  }),
  based({
    slug: "lentejas", name: "Spanischer Linseneintopf (Lentejas)", minuten: 40, portionen: 5, geraete: ["herd"], kost: "vegan", kcal: 200, protein_g: 11,
    zutaten: [Z("linsen", 200, "g"), Z("karotte", 1, "stueck"), Z("paprika", 1, "stueck"), Z("knoblauch", 4, "stueck"), Z("zwiebel", 1, "stueck"), Z("tomate", 2, "stueck"), Z("paprikapulver")],
    schritte: [
      "Linsen über Nacht einweichen und abgießen.",
      "Olivenöl in einem großen Topf erhitzen. Zwiebel, Karotte und Paprika klein schneiden und etwa 5 Minuten anbraten.",
      "Gehackten Knoblauch, gewürfelte Tomaten und nach Wunsch ein Lorbeerblatt etwa 4 Minuten mitbraten.",
      "Linsen, Paprikapulver und so viel Wasser dazugeben, dass es gut zwei Finger breit über den Linsen steht.",
      "Aufkochen, Hitze senken und offen 15 bis 20 Minuten köcheln, bis die Linsen gar sind. Salzen.",
    ],
  }),
  based({
    slug: "potato-pure", name: "Kartoffelpüree", minuten: 25, portionen: 4, geraete: ["herd"], kost: "vegetarisch", kcal: 260, protein_g: 7,
    zutaten: [Z("kartoffel", 1, "kg"), Z("milch", 200, "ml"), Z("butter", 15, "g"), Z("kaese", undefined, undefined, true)],
    schritte: [
      "Kartoffeln schälen und klein schneiden. Je kleiner, desto schneller sind sie gar.",
      "Mit Wasser bedeckt weich kochen, abgießen und mit einer Gabel zerdrücken.",
      "Milch erwärmen, aber nicht kochen. Butter, Kartoffeln und nach Wunsch geriebenen Käse einrühren, bis alles gleichmäßig ist.",
      "Auf dem Herd weiterrühren, bis das Püree so fest ist, wie du es magst.",
    ],
  }),
  based({
    slug: "spicy-sausage-pasta", name: "Scharfe Bratwurst-Pasta", minuten: 60, portionen: 4, geraete: ["herd"], kost: "alles", genuss: true, kcal: 880, protein_g: 30,
    zutaten: [Z("zwiebel", 2, "stueck"), Z("bratwurst", 6, "stueck"), Z("chili"), Z("rotwein", 250, "ml"), Z("passierte_tomaten", 800, "g"), Z("nudeln", 300, "g"), Z("parmesan", 50, "g"), Z("sahne", 300, "ml")],
    schritte: [
      "Zwiebeln hacken und in einer tiefen Pfanne in etwas Öl anbraten. Das Brät aus der Pelle drücken und mit gehacktem Chili und nach Wunsch Rosmarin dazugeben.",
      "Bei stärkerer Hitze das Brät mit dem Kochlöffel zerteilen und bräunen. Mit Rotwein ablöschen und auf die Hälfte einkochen.",
      "Tomaten dazugeben und offen etwa 30 Minuten einkochen. Nudeln nach Packungsangabe kochen.",
      "Nudeln abgießen und mit geriebenem Parmesan, Sahne, Salz und Pfeffer unter die Sauce rühren.",
    ],
  }),
];
