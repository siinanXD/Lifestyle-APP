import { describe, expect, test } from "vitest";
import { auswertung, zeitraum, type Eingabe } from "../../lib/fortschritt/auswertung";

// Erfundene Daten. Woche Mo 09.11. bis So 15.11.2026, davor eine Vorwoche mit wenigen Einträgen.
const daten = {
  workouts: [
    { id: "w0", started_at: "2026-11-04T17:00:00Z", ended_at: "2026-11-04T17:30:00Z" },
    { id: "w1", started_at: "2026-11-09T17:00:00Z", ended_at: "2026-11-09T18:00:00Z" },
    { id: "w2", started_at: "2026-11-11T17:00:00Z", ended_at: "2026-11-11T17:45:00Z" },
  ],
  saetze: [
    { workout_id: "w0", reps: 10, weight_kg: 40 },
    { workout_id: "w1", reps: 10, weight_kg: 50 },
    { workout_id: "w1", reps: 8, weight_kg: 60 },
    { workout_id: "w1", reps: 12, weight_kg: null },
    { workout_id: "w2", reps: 5, weight_kg: 100 },
  ],
  aktivitaeten: [
    { kategorie: "laufen", started_at: "2026-11-10T06:00:00Z", dauer_min: 30 },
    { kategorie: "laufen", started_at: "2026-11-12T06:00:00Z", dauer_min: 20 },
    { kategorie: "yoga", started_at: "2026-11-14T06:00:00Z", dauer_min: null },
  ],
  wasser: [
    { amount_ml: 1000, logged_at: "2026-11-03T08:00:00Z" },
    { amount_ml: 500, logged_at: "2026-11-09T08:00:00Z" },
    { amount_ml: 1000, logged_at: "2026-11-09T15:00:00Z" },
    { amount_ml: 2500, logged_at: "2026-11-10T08:00:00Z" },
  ],
  schlaf: [
    { datum: "2026-11-10", dauer_min: 420 },
    { datum: "2026-11-11", dauer_min: 480 },
  ],
  mahlzeiten: [
    { eaten_at: "2026-11-09T07:00:00Z" },
    { eaten_at: "2026-11-09T12:00:00Z" },
    { eaten_at: "2026-11-13T12:00:00Z" },
  ],
  gewohnheiten: [{ datum: "2026-11-02" }, { datum: "2026-11-09" }, { datum: "2026-11-09" }, { datum: "2026-11-15" }],
};
const woche: Eingabe = { von: "2026-11-09", bis: "2026-11-15", zeitzone: "Europe/Berlin", tageProWoche: 3, ...daten };

function friere<T>(wert: T): T {
  if (wert && typeof wert === "object") Object.values(wert).forEach(friere);
  return Object.freeze(wert);
}

describe("auswertung", () => {
  test("Woche mit vollständigen Daten", () => {
    const a = auswertung(woche);
    expect(a).toMatchObject({
      von: "2026-11-09",
      bis: "2026-11-15",
      einheiten: 2,
      einheitenGeplant: 3,
      aktiveMinuten: 155,
      volumenKg: 1480,
      aktivitaetenNachKategorie: { laufen: 2, yoga: 1 },
      wasserSchnittMl: 2000,
      schlafSchnittMin: 450,
      mahlzeitenTage: 2,
      mahlzeitenProTag: 1.5,
      gewohnheitsHaekchen: 3,
      erfassteTage: 7,
    });
    expect(a.tage).toHaveLength(7);
    expect(a.tage[0]).toEqual({ datum: "2026-11-09", einheiten: 1, wasserMl: 1500 });
    expect(a.tage[3]).toEqual({ datum: "2026-11-12", einheiten: 0, wasserMl: null });
  });

  test("Durchschnitt zählt nur Tage mit Einträgen", () => {
    // 4000 ml an 2 von 7 Tagen: 2000, nicht 571. 3 Mahlzeiten an 2 Tagen: 1,5.
    expect(auswertung(woche).wasserSchnittMl).toBe(2000);
    expect(auswertung(woche).mahlzeitenProTag).toBe(1.5);
    expect(auswertung({ ...woche, schlaf: [{ datum: "2026-11-10", dauer_min: 400 }] }).schlafSchnittMin).toBe(400);
  });

  test("Veränderung zur Vorperiode ist eine Zahl; ohne Wert auf einer Seite null", () => {
    expect(auswertung(woche).veraenderung).toEqual({
      einheiten: 1,
      aktiveMinuten: 125,
      volumenKg: 1080,
      wasserSchnittMl: 1000,
      schlafSchnittMin: null,
      mahlzeitenTage: null,
      mahlzeitenProTag: null,
      gewohnheitsHaekchen: 2,
    });
  });

  test("fehlende Vorperiode: Vergleich ist null", () => {
    const ohneVorwoche = auswertung({ ...woche, von: "2026-11-02", bis: "2026-11-08" });
    expect(ohneVorwoche.einheiten).toBe(1);
    expect(ohneVorwoche.veraenderung).toBeNull();
  });

  test("Woche ohne Daten: alles null, Einheiten 0", () => {
    const leer = auswertung({ von: "2026-11-09", bis: "2026-11-15", zeitzone: "Europe/Berlin", tageProWoche: null });
    expect(leer).toMatchObject({
      einheiten: 0,
      einheitenGeplant: null,
      aktiveMinuten: null,
      volumenKg: null,
      aktivitaetenNachKategorie: null,
      wasserSchnittMl: null,
      schlafSchnittMin: null,
      mahlzeitenTage: null,
      mahlzeitenProTag: null,
      gewohnheitsHaekchen: null,
      erfassteTage: 0,
      veraenderung: null,
    });
    expect(leer.tage.every((t) => t.einheiten === 0 && t.wasserMl === null)).toBe(true);
    // Leere Listen (geladen, aber nichts erfasst) verhalten sich wie nicht übergebene.
    expect(auswertung({ ...woche, workouts: [], saetze: [], aktivitaeten: [], wasser: [], schlaf: [], mahlzeiten: [], gewohnheiten: [] }))
      .toMatchObject({ einheiten: 0, aktiveMinuten: null, volumenKg: null, wasserSchnittMl: null, gewohnheitsHaekchen: null, erfassteTage: 0 });
  });

  test("Einheit nur mit Körpergewicht: Volumen bleibt null, nicht 0", () => {
    const a = auswertung({ ...woche, saetze: [{ workout_id: "w1", reps: 12, weight_kg: null }] });
    expect(a.einheiten).toBe(2);
    expect(a.volumenKg).toBeNull();
  });

  test("Teilwoche: zählt nur Tage im Zeitraum, vergleicht mit gleich vielen Tagen davor", () => {
    const a = auswertung({ ...woche, von: "2026-11-09", bis: "2026-11-10" });
    expect(a).toMatchObject({ einheiten: 1, einheitenGeplant: null, aktiveMinuten: 90, volumenKg: 980, erfassteTage: 2 });
    expect(a.tage.map((t) => t.datum)).toEqual(["2026-11-09", "2026-11-10"]);
    expect(a.veraenderung).toBeNull(); // 07./08.11. ohne Einträge
  });

  test("Monatswechsel: Woche über die Monatsgrenze und Kalendermonat mit Vormonat", () => {
    const workouts = [
      { id: "a", started_at: "2026-11-30T10:00:00Z", ended_at: null },
      { id: "b", started_at: "2026-12-01T10:00:00Z", ended_at: null },
      { id: "c", started_at: "2026-12-07T10:00:00Z", ended_at: null },
    ];
    const basis = { zeitzone: "Europe/Berlin", tageProWoche: 2, workouts };
    const w = auswertung({ ...basis, von: "2026-11-30", bis: "2026-12-06" });
    expect(w.einheiten).toBe(2);
    expect(w.tage.map((t) => t.datum)).toEqual([
      "2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06",
    ]);
    // Dezember (31 Tage) wird mit dem ganzen November (30 Tage) verglichen, nicht mit 31 Tagen davor.
    const m = auswertung({ ...basis, von: "2026-12-01", bis: "2026-12-31" });
    expect(m).toMatchObject({ einheiten: 2, einheitenGeplant: null, erfassteTage: 2 });
    expect(m.tage).toHaveLength(31);
    expect(m.veraenderung?.einheiten).toBe(1);
  });

  test("Zeitzonengrenze: der Tag richtet sich nach der übergebenen Zeitzone", () => {
    // So 08.11. 23:30 UTC ist in Berlin schon Mo 09.11. 00:30.
    const eingabe = {
      von: "2026-11-09",
      bis: "2026-11-15",
      tageProWoche: null,
      workouts: [{ id: "n", started_at: "2026-11-08T23:30:00Z", ended_at: null }],
      wasser: [{ amount_ml: 300, logged_at: "2026-11-08T23:30:00Z" }],
    };
    expect(auswertung({ ...eingabe, zeitzone: "Europe/Berlin" })).toMatchObject({ einheiten: 1, wasserSchnittMl: 300 });
    expect(auswertung({ ...eingabe, zeitzone: "UTC" })).toMatchObject({ einheiten: 0, wasserSchnittMl: null });
  });

  test("rein: gleiche Eingabe, gleiche Ausgabe; Eingaben bleiben unverändert", () => {
    const eingabe = friere(structuredClone(woche));
    const kopie = structuredClone(woche);
    const erste = auswertung(eingabe);
    expect(auswertung(eingabe)).toEqual(erste);
    expect(eingabe).toEqual(kopie);
  });

  test.each([
    ["2026-11-15", "2026-11-09"],
    ["09.11.2026", "2026-11-15"],
    ["2026-02-30", "2026-03-01"],
  ])("ungültiger Zeitraum %s bis %s wirft einen Fehler", (von, bis) => {
    expect(() => auswertung({ von, bis, zeitzone: "Europe/Berlin", tageProWoche: null })).toThrow("Zeitraum");
  });
});

describe("zeitraum", () => {
  test("Woche läuft von Montag bis Sonntag", () => {
    const erwartet = { von: "2026-11-09", bis: "2026-11-15" };
    expect(zeitraum("woche", new Date("2026-11-09T12:00:00Z"), "Europe/Berlin")).toEqual(erwartet);
    expect(zeitraum("woche", new Date("2026-11-15T12:00:00Z"), "Europe/Berlin")).toEqual(erwartet);
  });

  test("Woche über Monats- und Jahreswechsel", () => {
    expect(zeitraum("woche", new Date("2026-12-31T12:00:00Z"), "Europe/Berlin")).toEqual({ von: "2026-12-28", bis: "2027-01-03" });
  });

  test("Kalendermonat, auch Februar und Dezember", () => {
    expect(zeitraum("monat", new Date("2026-02-10T12:00:00Z"), "Europe/Berlin")).toEqual({ von: "2026-02-01", bis: "2026-02-28" });
    expect(zeitraum("monat", new Date("2028-02-10T12:00:00Z"), "Europe/Berlin")).toEqual({ von: "2028-02-01", bis: "2028-02-29" });
    expect(zeitraum("monat", new Date("2026-12-31T12:00:00Z"), "Europe/Berlin")).toEqual({ von: "2026-12-01", bis: "2026-12-31" });
  });

  test("Zeitzonengrenze: derselbe Zeitpunkt liegt je nach Zeitzone in einer anderen Woche oder einem anderen Monat", () => {
    const sonntagnacht = new Date("2026-11-15T23:30:00Z"); // Berlin: Mo 16.11. 00:30
    expect(zeitraum("woche", sonntagnacht, "UTC")).toEqual({ von: "2026-11-09", bis: "2026-11-15" });
    expect(zeitraum("woche", sonntagnacht, "Europe/Berlin")).toEqual({ von: "2026-11-16", bis: "2026-11-22" });
    const monatsende = new Date("2026-03-31T22:30:00Z"); // Berlin (Sommerzeit): 01.04. 00:30
    expect(zeitraum("monat", monatsende, "UTC").von).toBe("2026-03-01");
    expect(zeitraum("monat", monatsende, "Europe/Berlin")).toEqual({ von: "2026-04-01", bis: "2026-04-30" });
  });
});

describe("auswertung: Kategorienamen", () => {
  test("zählt auch Kategorien, die wie Objekt-Eigenschaften heißen", () => {
    const start = "2026-11-10T08:00:00Z";
    const a = auswertung({
      von: "2026-11-09",
      bis: "2026-11-15",
      zeitzone: "Europe/Berlin",
      tageProWoche: null,
      aktivitaeten: ["constructor", "constructor", "toString", "__proto__"].map((kategorie) => ({ kategorie, started_at: start, dauer_min: 10 })),
    });
    const zahlen = a.aktivitaetenNachKategorie!;
    expect(Object.entries(zahlen).sort()).toEqual([["__proto__", 1], ["constructor", 2], ["toString", 1]]);
  });
});
