import { describe, expect, test } from "vitest";
import { filtereUebungen, leseFilter, type Katalogeintrag } from "../../lib/training/katalog";

const u = (name: string, category: string, muscle_groups: string[], equipment: string[]): Katalogeintrag => ({
  id: name,
  name,
  category,
  muscle_groups,
  equipment,
});

const liste = [
  u("Liegestütz", "bodyweight", ["brust", "trizeps"], []),
  u("Kniebeuge mit Langhantel", "kraft", ["beine", "gesaess"], ["langhantel", "kniebeugenstaender"]),
  u("Bankdrücken mit Kurzhanteln", "kraft", ["brust", "trizeps"], ["kurzhanteln", "flachbank"]),
  u("Rudern mit Kurzhantel", "kraft", ["ruecken"], ["kurzhanteln"]),
  u("Joggen", "cardio", ["beine"], []),
];
const namen = (l: Katalogeintrag[]) => l.map((e) => e.name);

describe("filtereUebungen", () => {
  test("ohne Filter: alle in der gegebenen Reihenfolge", () => {
    expect(filtereUebungen(liste, {})).toEqual(liste);
  });

  test("Kategorie", () => {
    expect(namen(filtereUebungen(liste, { kategorie: "kraft" }))).toEqual([
      "Kniebeuge mit Langhantel",
      "Bankdrücken mit Kurzhanteln",
      "Rudern mit Kurzhantel",
    ]);
  });

  test("Muskelgruppe", () => {
    expect(namen(filtereUebungen(liste, { muskel: "beine" }))).toEqual(["Kniebeuge mit Langhantel", "Joggen"]);
  });

  test("ohne Geräte = equipment leer", () => {
    expect(namen(filtereUebungen(liste, { geraete: "ohne" }))).toEqual(["Liegestütz", "Joggen"]);
  });

  test("meine Geräte = benötigte Geräte sind Teilmenge der eigenen", () => {
    expect(namen(filtereUebungen(liste, { geraete: "meine", meineGeraete: ["kurzhanteln"] }))).toEqual([
      "Liegestütz",
      "Rudern mit Kurzhantel",
      "Joggen",
    ]);
    expect(namen(filtereUebungen(liste, { geraete: "meine", meineGeraete: ["kurzhanteln", "flachbank"] }))).toContain(
      "Bankdrücken mit Kurzhanteln",
    );
  });

  test("meine Geräte, aber im Profil keine angegeben = alles", () => {
    expect(filtereUebungen(liste, { geraete: "meine", meineGeraete: [] })).toEqual(liste);
  });

  test("Namenssuche: Teilstring, Groß-/Kleinschreibung egal, Leerzeichen am Rand egal", () => {
    expect(namen(filtereUebungen(liste, { suche: "  kurzhantel " }))).toEqual(["Bankdrücken mit Kurzhanteln", "Rudern mit Kurzhantel"]);
    expect(namen(filtereUebungen(liste, { suche: "LIEGE" }))).toEqual(["Liegestütz"]);
  });

  test("Kombination: alle Filter gelten zugleich", () => {
    expect(namen(filtereUebungen(liste, { kategorie: "kraft", muskel: "brust", geraete: "meine", meineGeraete: ["kurzhanteln", "flachbank"], suche: "bank" }))).toEqual([
      "Bankdrücken mit Kurzhanteln",
    ]);
    expect(filtereUebungen(liste, { kategorie: "cardio", geraete: "meine", meineGeraete: ["kurzhanteln"], muskel: "brust" })).toEqual([]);
  });
});

describe("leseFilter", () => {
  test("übernimmt gültige URL-Parameter", () => {
    expect(leseFilter({ kategorie: "kraft", muskel: "brust", geraete: "ohne", suche: " bank " })).toEqual({
      kategorie: "kraft",
      muskel: "brust",
      geraete: "ohne",
      suche: "bank",
    });
  });

  test("verwirft Unbekanntes, Leeres und Mehrfachwerte", () => {
    expect(leseFilter({ kategorie: "", geraete: "alle", muskel: ["a", "b"], suche: "   " })).toEqual({});
  });
});
