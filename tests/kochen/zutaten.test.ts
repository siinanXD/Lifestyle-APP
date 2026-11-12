import { expect, test } from "vitest";
import { istGrundzutat, ordneZu, ZUTATEN, ZUTATNAMEN } from "../../lib/kochen/zutaten";

test.each([
  ["Eier", "ei"],
  ["ei", "ei"],
  ["Bio Eier 10er", "ei"],
  ["TOMATEN", "tomate"],
  ["Tomate", "tomate"],
  ["Passierte Tomaten 500g", "passierte_tomaten"],
  ["Kartoffeln", "kartoffel"],
  ["Süßkartoffel", "suesskartoffel"],
  ["Möhren", "karotte"],
  ["rote Paprika", "paprika"],
  ["Hähnchenbrustfilet frisch", "haehnchenbrust"],
  ["Rinderhack", "hackfleisch"],
  ["griechischer Joghurt", "joghurt"],
  ["Hafermilch", "haferdrink"],
  ["Olivenöl", "oel"],
  ["Spaghetti", "nudeln"],
  ["Gouda jung", "kaese"],
] as const)("„%s“ → %s", (text, key) => expect(ordneZu(text)).toBe(key));

test("ganze Wörter müssen passen: Kokosmilch ist keine Milch, Erdnussbutter keine Butter", () => {
  expect(ordneZu("Kokosmilch")).toBe("kokosmilch");
  expect(ordneZu("Erdnussbutter")).toBe("erdnussbutter");
  expect(ordneZu("Buttermilch")).toBeNull();
});

test("unbekannt oder leer → kein Schlüssel", () => {
  for (const text of ["Spülmittel", "Zahnpasta", "", "   ", "123"]) expect(ordneZu(text), text).toBeNull();
});

test("jeder Name und jede Schreibweise der Liste findet zu ihrer eigenen Zutat zurück", () => {
  for (const [key, z] of Object.entries(ZUTATEN)) {
    for (const schreibweise of [z.name, ...("auch" in z ? z.auch : [])]) expect(ordneZu(schreibweise), `${schreibweise} (${key})`).toBe(key);
  }
});

test("Grundzutaten und Vorschlagsliste", () => {
  expect(["salz", "pfeffer", "oel", "wasser"].every(istGrundzutat)).toBe(true);
  expect(istGrundzutat("ei")).toBe(false);
  expect(ZUTATNAMEN).toContain("Hähnchenbrust");
  expect(new Set(ZUTATNAMEN).size).toBe(ZUTATNAMEN.length);
});
