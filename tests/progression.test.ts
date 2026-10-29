import { describe, expect, test } from "vitest";
import { bewerteProgression, type Einheit, type Ziel } from "../lib/training/progression";

const ziel: Ziel = { wdhMin: 8, wdhMax: 10 };
const stufe = 2.5;

const einheit = (teil: Partial<Einheit> = {}): Einheit => ({
  gewichtKg: 20,
  wiederholungenProSatz: [10, 10, 10],
  technik: "sauber",
  schmerz: false,
  regeneration: "gut",
  ...teil,
});

const dreiGute = () => [einheit(), einheit(), einheit()];

describe("bewerteProgression", () => {
  test("leere Liste: halten, zu wenig Einheiten", () => {
    expect(bewerteProgression([], ziel, stufe)).toEqual({ aktion: "halten", grund: "zu_wenig_einheiten" });
  });

  test("weniger als 3 Einheiten: halten, zu wenig Einheiten", () => {
    expect(bewerteProgression([einheit(), einheit()], ziel, stufe)).toEqual({
      aktion: "halten",
      grund: "zu_wenig_einheiten",
    });
  });

  test("zu wenig Einheiten hat Vorrang vor Schmerz", () => {
    expect(bewerteProgression([einheit({ schmerz: true })], ziel, stufe)).toEqual({
      aktion: "halten",
      grund: "zu_wenig_einheiten",
    });
  });

  test("Gewicht wechselte innerhalb der drei jüngsten", () => {
    const einheiten = [einheit(), einheit({ gewichtKg: 22.5 }), einheit()];
    expect(bewerteProgression(einheiten, ziel, stufe)).toEqual({ aktion: "halten", grund: "gewicht_wechselte" });
  });

  test("Schmerz in einer der drei: halten, Schmerz", () => {
    const einheiten = [einheit(), einheit({ schmerz: true }), einheit()];
    expect(bewerteProgression(einheiten, ziel, stufe)).toEqual({ aktion: "halten", grund: "schmerz" });
  });

  test("Schmerz hat Vorrang vor Gewichtswechsel, Technik, Regeneration und Ziel", () => {
    const einheiten = [
      einheit({ schmerz: true, gewichtKg: 17.5, technik: "wackelig", wiederholungenProSatz: [5] }),
      einheit({ regeneration: "schlecht" }),
      einheit(),
    ];
    expect(bewerteProgression(einheiten, ziel, stufe)).toEqual({ aktion: "halten", grund: "schmerz" });
  });

  test("irgendeine Technik wackelig: halten, Technik", () => {
    const einheiten = [einheit({ technik: "wackelig" }), einheit(), einheit()];
    expect(bewerteProgression(einheiten, ziel, stufe)).toEqual({ aktion: "halten", grund: "technik" });
  });

  test("jüngste Regeneration schlecht: halten, Regeneration", () => {
    const einheiten = [einheit(), einheit(), einheit({ regeneration: "schlecht" })];
    expect(bewerteProgression(einheiten, ziel, stufe)).toEqual({ aktion: "halten", grund: "regeneration" });
  });

  test("schlechte Regeneration in älterer der drei zählt nicht, unbekannte jüngste auch nicht", () => {
    const einheiten = [einheit({ regeneration: "schlecht" }), einheit(), einheit({ regeneration: "unbekannt" })];
    expect(bewerteProgression(einheiten, ziel, stufe)).toEqual({ aktion: "steigerung_pruefen", vorschlagKg: 22.5 });
  });

  test("ein Satz unter oberem Ziel: halten, Ziel nicht erreicht", () => {
    const einheiten = [einheit(), einheit({ wiederholungenProSatz: [10, 10, 9] }), einheit()];
    expect(bewerteProgression(einheiten, ziel, stufe)).toEqual({ aktion: "halten", grund: "ziel_nicht_erreicht" });
  });

  test("Einheit ohne Sätze erreicht das Ziel nicht", () => {
    const einheiten = [einheit(), einheit({ wiederholungenProSatz: [] }), einheit()];
    expect(bewerteProgression(einheiten, ziel, stufe)).toEqual({ aktion: "halten", grund: "ziel_nicht_erreicht" });
  });

  test("alles erfüllt: Steigerung prüfen um genau eine Stufe", () => {
    expect(bewerteProgression(dreiGute(), ziel, stufe)).toEqual({ aktion: "steigerung_pruefen", vorschlagKg: 22.5 });
  });

  test("Wiederholungen über dem oberen Ziel zählen, kein Mehrfach-Sprung", () => {
    const einheiten = [1, 2, 3].map(() => einheit({ wiederholungenProSatz: [14, 13, 12] }));
    expect(bewerteProgression(einheiten, ziel, stufe)).toEqual({ aktion: "steigerung_pruefen", vorschlagKg: 22.5 });
  });

  test("ältere Einheiten vor den drei jüngsten beeinflussen das Ergebnis nicht", () => {
    const alt = [
      einheit({ schmerz: true, gewichtKg: 10, technik: "wackelig", wiederholungenProSatz: [3] }),
      einheit({ regeneration: "schlecht", gewichtKg: 12.5 }),
    ];
    expect(bewerteProgression([...alt, ...dreiGute()], ziel, stufe)).toEqual({
      aktion: "steigerung_pruefen",
      vorschlagKg: 22.5,
    });
  });

  test("Eingabe wird nicht verändert", () => {
    const einheiten = [...dreiGute(), einheit()];
    const kopie = structuredClone(einheiten);
    bewerteProgression(einheiten, ziel, stufe);
    expect(einheiten).toEqual(kopie);
  });
});

describe("bewerteProgression: ungültige Eingaben", () => {
  test.each([0, -2.5, Number.NaN])("kleinsteStufeKg %s wirft", (wert) => {
    expect(() => bewerteProgression(dreiGute(), ziel, wert)).toThrow("kleinsteStufeKg muss größer als 0 sein");
  });

  test("wdhMin > wdhMax wirft", () => {
    expect(() => bewerteProgression(dreiGute(), { wdhMin: 12, wdhMax: 8 }, stufe)).toThrow(
      "wdhMin darf nicht größer als wdhMax sein",
    );
  });

  test("negative Wiederholungen werfen, auch in älteren Einheiten und bei leerer Prüfung", () => {
    const einheiten = [einheit({ wiederholungenProSatz: [10, -1] }), ...dreiGute()];
    expect(() => bewerteProgression(einheiten, ziel, stufe)).toThrow("Wiederholungen dürfen nicht negativ sein");
  });

  test("Ungültiges wird auch bei zu wenig Einheiten geprüft", () => {
    expect(() => bewerteProgression([], ziel, 0)).toThrow("kleinsteStufeKg muss größer als 0 sein");
  });
});
