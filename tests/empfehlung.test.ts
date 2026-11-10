import { describe, expect, test } from "vitest";
import { bewerteComeback } from "../lib/training/comeback";
import { empfehle } from "../lib/training/empfehlung";
import type { Einheit, Ziel } from "../lib/training/progression";

const ziel: Ziel = { wdhMin: 8, wdhMax: 10 };
const kleinsteStufeKg = 2.5;

const einheit = (teil: Partial<Einheit> = {}): Einheit => ({
  gewichtKg: 20,
  wiederholungenProSatz: [10, 10, 10],
  technik: "sauber",
  schmerz: false,
  regeneration: "gut",
  ...teil,
});

const dreiGute = (teil: Partial<Einheit> = {}) => [einheit(teil), einheit(teil), einheit(teil)];

describe("empfehle", () => {
  test("Comeback Stufe 2: Gewicht ×0,8 auf Stufe gerundet, ein Satz weniger, Progression übersprungen", () => {
    const comeback = bewerteComeback(30);
    expect(empfehle({ einheiten: dreiGute({ gewichtKg: 72.5 }), ziel, kleinsteStufeKg, comeback })).toEqual({
      aktion: "sanfter_einstieg",
      zielgewichtKg: 57.5, // 72,5 × 0,8 = 58 → nach unten auf 2,5er-Stufe
      saetze: 2,
      satzAbzug: 1,
      grund: "comeback_stufe_2",
    });
  });

  test("Comeback Stufe 1: nur weniger Gewicht, Sätze bleiben", () => {
    expect(empfehle({ einheiten: dreiGute(), ziel, kleinsteStufeKg, comeback: bewerteComeback(14) })).toEqual({
      aktion: "sanfter_einstieg",
      zielgewichtKg: 17.5,
      saetze: 3,
      satzAbzug: 0,
      grund: "comeback_stufe_1",
    });
  });

  test("Comeback Stufe 3: Gewicht ×0,6", () => {
    expect(empfehle({ einheiten: dreiGute(), ziel, kleinsteStufeKg, comeback: bewerteComeback(100) })).toMatchObject({
      aktion: "sanfter_einstieg",
      zielgewichtKg: 10, // 20 × 0,6 = 12 → 10
      grund: "comeback_stufe_3",
    });
  });

  test("Comeback Stufe 0: normale Progression", () => {
    expect(empfehle({ einheiten: dreiGute(), ziel, kleinsteStufeKg, comeback: bewerteComeback(3) })).toEqual({
      aktion: "steigerung_pruefen",
      zielgewichtKg: 22.5,
      saetze: 3,
      satzAbzug: 0,
      grund: "ziel_erreicht",
    });
  });

  test("ohne Comeback: Halten übernimmt den Grund der Progression und das letzte Gewicht", () => {
    const einheiten = [einheit(), einheit({ schmerz: true }), einheit()];
    expect(empfehle({ einheiten, ziel, kleinsteStufeKg })).toEqual({
      aktion: "halten",
      zielgewichtKg: 20,
      saetze: 3,
      satzAbzug: 0,
      grund: "schmerz",
    });
  });

  test.each([20, 22.5, 37.5, 41, 72.5, 101.25])("Rundung nie über dem Faktorgewicht (%d kg)", (gewichtKg) => {
    for (const tage of [14, 28, 84]) {
      const comeback = bewerteComeback(tage);
      for (const stufe of [0.5, 1.25, 2.5, 5]) {
        const { zielgewichtKg } = empfehle({ einheiten: [einheit({ gewichtKg })], ziel, kleinsteStufeKg: stufe, comeback });
        expect(zielgewichtKg).toBeLessThanOrEqual(gewichtKg * comeback.gewichtFaktor);
        expect(zielgewichtKg).toBeGreaterThan(gewichtKg * comeback.gewichtFaktor - stufe);
        expect((zielgewichtKg as number) / stufe).toBeCloseTo(Math.round((zielgewichtKg as number) / stufe));
      }
    }
  });

  test("Satzzahl fällt nie unter 1", () => {
    const einheiten = [einheit({ wiederholungenProSatz: [10] })];
    expect(empfehle({ einheiten, ziel, kleinsteStufeKg, comeback: bewerteComeback(30) }).saetze).toBe(1);
  });

  test("ohne Einheiten gibt es kein Zielgewicht", () => {
    expect(empfehle({ einheiten: [], ziel, kleinsteStufeKg })).toEqual({
      aktion: "halten",
      zielgewichtKg: null,
      saetze: null,
      satzAbzug: 0,
      grund: "zu_wenig_einheiten",
    });
    expect(empfehle({ einheiten: [], ziel, kleinsteStufeKg, comeback: bewerteComeback(30) })).toEqual({
      aktion: "sanfter_einstieg",
      zielgewichtKg: null,
      saetze: null,
      satzAbzug: 1,
      grund: "comeback_stufe_2",
    });
  });

  test("ungültige kleinste Stufe wirft auch im Comeback", () => {
    expect(() => empfehle({ einheiten: dreiGute(), ziel, kleinsteStufeKg: 0, comeback: bewerteComeback(30) })).toThrow(
      "kleinsteStufeKg muss größer als 0 sein",
    );
  });
});
