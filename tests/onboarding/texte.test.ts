import { expect, test } from "vitest";
import * as texte from "../../lib/onboarding/texte";

const alleTexte = JSON.stringify(texte);

test("keine Druck-Wörter (ONBOARDING.md Grundregel 3)", () => {
  for (const wort of ["musst", "solltest", "schaffst"]) expect(alleTexte.toLowerCase()).not.toContain(wort);
});

test("Fragen im Wortlaut aus ONBOARDING.md", () => {
  expect(texte.FRAGEN.ziele).toBe("Was möchtest du erreichen? Beschreib es so, wie du es sagen würdest.");
  expect(texte.FRAGEN.zeit).toBe("Wie viel Zeit passt in deinen Alltag?");
  expect(texte.FRAGEN.erfahrung).toBe("Wo stehst du gerade?");
  expect(texte.FRAGEN.einschraenkungen).toBe("Gibt es etwas, worauf wir Rücksicht nehmen sollen?");
  expect(texte.FRAGEN.geraete).toBe("Was hast du zum Trainieren?");
  expect(texte.FRAGEN.freiwillig).toBe("Magst du noch etwas teilen? Alles hier ist optional.");
});

test("Auswahlwerte passen zu den Checks in der Datenbank", () => {
  expect(Object.keys(texte.ERFAHRUNG)).toEqual(["anfaenger", "wiedereinstieg", "regelmaessig"]);
  expect(Object.keys(texte.EINSCHRAENKUNGEN)).toEqual(["knie", "ruecken", "schulter", "handgelenk", "sonstiges"]);
  expect(texte.MINUTEN).toEqual([15, 30, 45, 60]);
  expect(texte.TAGE).toEqual([1, 2, 3, 4, 5, 6]);
});

test("Hinweis gegen Diagnosen im Freitext", () => {
  expect(texte.HINWEIS_FREITEXT).toBe("Bitte keine Diagnosen oder Medikamente eintragen.");
});

test("Geräte-Schlüssel wie in SIN-1264 festgelegt", () => {
  expect(Object.keys(texte.GERAETE)).toEqual(["keine", "kurzhanteln", "langhantel", "kabelzug", "baender", "kardio", "studio"]);
});
