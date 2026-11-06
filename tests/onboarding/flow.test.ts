import { describe, expect, test } from "vitest";
import {
  allesUeberspringen,
  naechster,
  schritte,
  teileFreiwillig,
  vorheriger,
  zusammenfassung,
  zuSpeichern,
  type Antworten,
  type Einwilligungen,
} from "../../lib/onboarding/flow";

const alle: Einwilligungen = { A: true, B: true, E: true };
const nurA: Einwilligungen = { A: true, B: false, E: false };
const offen: Einwilligungen = {};

const voll: Antworten = {
  ziele: ["mehr_ausdauer", "kraeftiger"],
  zielNotiz: "Treppen ohne Pause",
  tageProWoche: 3,
  minutenProEinheit: 30,
  erfahrung: "anfaenger",
  einschraenkungen: ["knie"],
  einschraenkungNotiz: "beim Laufen",
  geraete: ["kurzhanteln"],
  gewichtKg: 80,
  groesseCm: 180,
  gewohnheiten: true,
  coach: true,
};

describe("schritte", () => {
  test("mit A, B und E: alle Schritte in Reihenfolge laut ONBOARDING.md", () => {
    expect(schritte(alle)).toEqual([
      "willkommen",
      "ziele",
      "zeit",
      "erfahrung",
      "einschraenkungen",
      "geraete",
      "freiwillig",
      "zusammenfassung",
    ]);
  });

  test("noch nicht gefragt zählt wie erlaubt, damit die Einwilligung im Schritt gefragt werden kann", () => {
    expect(schritte(offen)).toEqual(schritte(alle));
  });

  test("ohne A entfallen 1, 2, 3, 5 und auch 4 und 6 (ONBOARDING.md Schritt 0)", () => {
    expect(schritte({ A: false, B: true, E: true })).toEqual(["willkommen", "zusammenfassung"]);
  });

  test("ohne B entfällt Schritt 4", () => {
    expect(schritte(nurA)).toEqual(["willkommen", "ziele", "zeit", "erfahrung", "geraete", "freiwillig", "zusammenfassung"]);
  });

  test("Schritt 6: ohne B keine Körperwerte, ohne E kein Coach", () => {
    expect(teileFreiwillig(alle)).toEqual(["koerperwerte", "gewohnheiten", "coach"]);
    expect(teileFreiwillig(nurA)).toEqual(["gewohnheiten"]);
    expect(teileFreiwillig({ A: true, B: true, E: false })).toEqual(["koerperwerte", "gewohnheiten"]);
    expect(teileFreiwillig({ A: false, B: true, E: true })).toEqual([]);
  });
});

describe("naechster und vorheriger", () => {
  test("Weiter folgt der Schrittliste, nach der Zusammenfassung kommt Start", () => {
    expect(naechster("willkommen", alle)).toBe("ziele");
    expect(naechster("erfahrung", nurA)).toBe("geraete");
    expect(naechster("zusammenfassung", alle)).toBe("start");
  });

  test("Weiter ohne A springt von Willkommen direkt zur Zusammenfassung", () => {
    expect(naechster("willkommen", { A: false })).toBe("zusammenfassung");
  });

  test("Zurück vom ersten Schritt bleibt auf dem ersten Schritt", () => {
    expect(vorheriger("willkommen", alle)).toBe("willkommen");
  });

  test("Zurück überspringt entfallene Schritte", () => {
    expect(vorheriger("geraete", nurA)).toBe("erfahrung");
    expect(vorheriger("geraete", alle)).toBe("einschraenkungen");
  });

  test("Schritt, der nach einer Ablehnung entfallen ist: Weiter und Zurück landen auf erlaubten Schritten", () => {
    expect(naechster("einschraenkungen", nurA)).toBe("geraete");
    expect(vorheriger("einschraenkungen", nurA)).toBe("erfahrung");
  });

  test("Alles überspringen führt zu Start", () => {
    expect(allesUeberspringen()).toBe("start");
  });
});

describe("zuSpeichern", () => {
  test("ohne A wird nichts gespeichert, auch wenn Antworten da sind", () => {
    expect(zuSpeichern(voll, { A: false, B: true, E: true })).toEqual({});
  });

  test("ohne B weder Einschränkungen noch Gewicht oder Größe", () => {
    const daten = zuSpeichern(voll, nurA);
    expect(daten.gesundheit).toBeUndefined();
    expect(daten.koerperwerte).toBeUndefined();
    expect(JSON.stringify(daten)).not.toMatch(/restriction|weight|height|knie|80|180/);
    expect(daten.profil).toEqual({
      goals: ["mehr_ausdauer", "kraeftiger"],
      goal_note: "Treppen ohne Pause",
      days_per_week: 3,
      minutes_per_session: 30,
      experience: "anfaenger",
      equipment: ["kurzhanteln"],
    });
    expect(daten.coach).toBeUndefined();
  });

  test("noch nicht gefragt zählt beim Speichern als nicht erteilt", () => {
    expect(zuSpeichern(voll, offen)).toEqual({});
  });

  test("mit A, B und E landen die Angaben in ihren Bereichen", () => {
    expect(zuSpeichern(voll, alle)).toEqual({
      profil: {
        goals: ["mehr_ausdauer", "kraeftiger"],
        goal_note: "Treppen ohne Pause",
        days_per_week: 3,
        minutes_per_session: 30,
        experience: "anfaenger",
        equipment: ["kurzhanteln"],
      },
      gesundheit: { restrictions: ["knie"], restriction_note: "beim Laufen", height_cm: 180 },
      koerperwerte: { weight_kg: 80 },
      coach: true,
    });
  });

  test("übersprungene Felder fehlen statt leer gespeichert zu werden", () => {
    expect(zuSpeichern({ tageProWoche: 2 }, alle)).toEqual({ profil: { days_per_week: 2 } });
  });

  test("Körperwerte und Einschränkungen nur, wenn Schritt 6 sie einschaltet bzw. angegeben sind", () => {
    expect(zuSpeichern({ ziele: ["kraeftiger"] }, alle)).toEqual({ profil: { goals: ["kraeftiger"] } });
  });
});

describe("zusammenfassung", () => {
  test("Übersprungenes steht als „nicht angegeben“", () => {
    expect(zusammenfassung({})).toEqual([
      { label: "Ziel", wert: "nicht angegeben" },
      { label: "Zeit", wert: "nicht angegeben" },
      { label: "Erfahrung", wert: "nicht angegeben" },
      { label: "Geräte", wert: "nicht angegeben" },
      { label: "Rücksicht", wert: "nicht angegeben" },
    ]);
  });

  test("Beantwortetes erscheint mit dem Wortlaut der Auswahl", () => {
    expect(zusammenfassung(voll)).toEqual([
      { label: "Ziel", wert: "Mehr Ausdauer, Kräftiger werden" },
      { label: "Zeit", wert: "3 Tage · 30 Min" },
      { label: "Erfahrung", wert: "Ich fange an" },
      { label: "Geräte", wert: "Kurzhanteln" },
      { label: "Rücksicht", wert: "Knie" },
    ]);
  });

  test("nur Tage oder nur Minuten", () => {
    expect(zusammenfassung({ minutenProEinheit: 45 })[1]).toEqual({ label: "Zeit", wert: "45 Min" });
    expect(zusammenfassung({ tageProWoche: 1 })[1]).toEqual({ label: "Zeit", wert: "1 Tag" });
  });
});
