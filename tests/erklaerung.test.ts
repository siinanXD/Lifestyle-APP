import { describe, expect, test } from "vitest";
import type { Grund } from "../lib/training/empfehlung";
import { ERKLAERUNGEN, erklaere } from "../lib/training/erklaerung";

// Vollständig über die Typ-Union: Kommt ein Code hinzu, schlägt hier `npm run typecheck` fehl, bis er eingetragen ist –
// und der Test unten, bis er einen Text hat.
const alleCodes: Record<Grund, true> = {
  zu_wenig_einheiten: true,
  gewicht_wechselte: true,
  ziel_nicht_erreicht: true,
  technik: true,
  schmerz: true,
  regeneration: true,
  ziel_erreicht: true,
  comeback_stufe_1: true,
  comeback_stufe_2: true,
  comeback_stufe_3: true,
};
const codes = Object.keys(alleCodes) as Grund[];

describe("erklaere", () => {
  test.each(codes)("%s hat einen Text aus ein bis zwei Sätzen", (code) => {
    const text = erklaere(code);
    expect(text.trim()).toBe(text);
    const saetze = text.split(/(?<=[.!?])\s+/);
    expect(saetze.length).toBeGreaterThanOrEqual(1);
    expect(saetze.length).toBeLessThanOrEqual(2);
    expect(text).toMatch(/[.!?]$/);
  });

  test("es gibt genau für die bekannten Codes Texte, jeder Text ist ein anderer", () => {
    expect(Object.keys(ERKLAERUNGEN).sort()).toEqual([...codes].sort());
    expect(new Set(Object.values(ERKLAERUNGEN)).size).toBe(codes.length);
  });

  test.each(codes)("%s: kein Druck und keine Diagnose im Text", (code) => {
    expect(erklaere(code)).not.toMatch(/musst|solltest|schaffst|diagnose/i);
  });

  test("Steigerung ist ein Angebot zum Ausprobieren", () => {
    expect(erklaere("ziel_erreicht")).toMatch(/prüfen|kannst du ausprobieren/);
  });

  test("Schmerz hält das Gewicht und verweist auf ärztlichen Rat", () => {
    expect(erklaere("schmerz")).toMatch(/bleibt das Gewicht gleich/);
    expect(erklaere("schmerz")).toMatch(/ärztlichen Rat/);
  });
});
