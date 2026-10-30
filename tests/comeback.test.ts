import { describe, expect, test } from "vitest";
import { bewerteComeback } from "../lib/training/comeback";

describe("bewerteComeback", () => {
  test.each([
    [0, 0, 1, 0, 0],
    [13, 0, 1, 0, 0],
    [14, 1, 0.9, 0, 1],
    [27, 1, 0.9, 0, 1],
    [28, 2, 0.8, 1, 1],
    [83, 2, 0.8, 1, 1],
    [84, 3, 0.6, 1, 4],
    [400, 3, 0.6, 1, 4],
  ])("%i Tage: Stufe %i, Gewicht ×%d, Sätze −%i, Progression %i Einheiten aus", (tage, stufe, gewicht, saetze, pause) => {
    expect(bewerteComeback(tage)).toEqual({
      stufe,
      gewichtFaktor: gewicht,
      satzAbzug: saetze,
      progressionAusEinheiten: pause,
    });
  });

  test("schlecht stuft eine Stufe weiter runter", () => {
    expect(bewerteComeback(5, "schlecht").stufe).toBe(1);
    expect(bewerteComeback(14, "schlecht")).toMatchObject({ stufe: 2, gewichtFaktor: 0.8, satzAbzug: 1 });
    expect(bewerteComeback(28, "schlecht")).toMatchObject({ stufe: 3, gewichtFaktor: 0.6 });
  });

  test("schlecht ab Stufe 3 bleibt bei Stufe 3", () => {
    expect(bewerteComeback(200, "schlecht")).toEqual(bewerteComeback(200, "gut"));
  });

  test.each([0, 13, 14, 28, 84, 300])("%i Tage: schlecht senkt nie weniger als gut", (tage) => {
    const gut = bewerteComeback(tage, "gut");
    const schlecht = bewerteComeback(tage, "schlecht");
    expect(schlecht.gewichtFaktor).toBeLessThanOrEqual(gut.gewichtFaktor);
    expect(schlecht.satzAbzug).toBeGreaterThanOrEqual(gut.satzAbzug);
    expect(schlecht.progressionAusEinheiten).toBeGreaterThanOrEqual(gut.progressionAusEinheiten);
  });

  test.each([0, 13, 14, 28, 84, 300])("%i Tage: nicht angegeben und mittel ergeben dasselbe wie gut", (tage) => {
    expect(bewerteComeback(tage)).toEqual(bewerteComeback(tage, "gut"));
    expect(bewerteComeback(tage, undefined)).toEqual(bewerteComeback(tage, "gut"));
    expect(bewerteComeback(tage, "mittel")).toEqual(bewerteComeback(tage, "gut"));
  });

  test.each([-1, -0.5, Number.NaN, Number.POSITIVE_INFINITY])("ungültige Tage %d werfen einen Fehler", (tage) => {
    expect(() => bewerteComeback(tage)).toThrow("Tage");
  });
});
