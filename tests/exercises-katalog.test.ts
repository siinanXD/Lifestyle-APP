import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { GERAETE } from "../lib/training/geraete";

// SIN-1267: liest die Katalog-Migration als Text (eine Zeile je Übung) und prüft Inhalt und Mindestzahlen.
const datei = readdirSync("supabase/migrations").find((f) => f.endsWith("_lifestyle_exercises_katalog.sql"))!;
const sql = readFileSync(`supabase/migrations/${datei}`, "utf8");
const liste = (text: string) => (text === "" ? [] : text.split(","));
const uebungen = [...sql.matchAll(/^ {2}\('([^']+)', '([^']+)', '([^']+)', '\{([^}]*)\}', '\{([^}]*)\}', '\{([^}]*)\}', (\d), (null|'[^']+'), '([^']+)'\),?$/gm)].map(
  ([, slug, name, category, muskeln, geraete, gelenke, schwierigkeit, variante, technik]) => ({
    slug, name, category, muskeln: liste(muskeln), geraete: liste(geraete), gelenke: liste(gelenke),
    schwierigkeit: Number(schwierigkeit), variante: variante === "null" ? null : variante.slice(1, -1), technik,
  }),
);
const anzahl = (passt: (u: (typeof uebungen)[number]) => boolean) => uebungen.filter(passt).length;

test("jede Zeile der Migration wird gelesen (rund 40 Übungen)", () => {
  expect(uebungen.length).toBe(sql.split("\n").filter((z) => z.startsWith("  ('")).length);
  expect(uebungen.length).toBeGreaterThanOrEqual(40);
  expect(sql).toContain("on conflict (slug) do nothing");
});

test("jeder Slug ist eindeutig; die bisherigen Slugs bleiben", () => {
  const slugs = uebungen.map((u) => u.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
  for (const alt of ["liegestuetz", "kniebeuge-koerpergewicht", "plank", "kniebeuge-langhantel", "bankdruecken-kurzhantel", "joggen", "huefte-kreisen", "oberschenkel-dehnen", "rudern-kurzhantel"]) {
    expect(slugs).toContain(alt);
  }
});

test("Kategorie, Geräte, Gelenke und Schwierigkeit sind gültig", () => {
  const geraete = Object.keys(GERAETE).filter((g) => g !== "keine");
  for (const u of uebungen) {
    expect(["kraft", "cardio", "bodyweight", "mobility", "dehnen"], u.slug).toContain(u.category);
    for (const g of u.geraete) expect(geraete, `${u.slug}: ${g}`).toContain(g);
    for (const j of u.gelenke) expect(["knie", "ruecken", "schulter", "handgelenk", "huefte"], `${u.slug}: ${j}`).toContain(j);
    expect(u.schwierigkeit, u.slug).toBeGreaterThanOrEqual(1);
    expect(u.schwierigkeit, u.slug).toBeLessThanOrEqual(3);
  }
});

test("jede Variante zeigt auf einen vorhandenen, anderen Slug", () => {
  const slugs = new Set(uebungen.map((u) => u.slug));
  const mitVariante = uebungen.filter((u) => u.variante !== null);
  expect(mitVariante.length).toBeGreaterThan(0);
  for (const u of mitVariante) {
    expect(slugs.has(u.variante!), u.slug).toBe(true);
    expect(u.variante, u.slug).not.toBe(u.slug);
  }
});

test("Technikhinweise: 2 bis 3 Sätze, keine Heil- oder Diagnoseaussagen", () => {
  for (const u of uebungen) {
    const saetze = u.technik.split(/(?<=\.)\s+/).length;
    expect(saetze, u.slug).toBeGreaterThanOrEqual(2);
    expect(saetze, u.slug).toBeLessThanOrEqual(3);
    expect(u.technik, u.slug).not.toMatch(/diagnos|heil|therap|schmerz|medikament/i);
  }
});

test("Mindestzahlen: ohne Geräte, Kurzhanteln, Cardio, Mobility/Dehnen", () => {
  expect(anzahl((u) => u.geraete.length === 0)).toBeGreaterThanOrEqual(12);
  expect(anzahl((u) => u.geraete.includes("kurzhanteln"))).toBeGreaterThanOrEqual(8);
  expect(anzahl((u) => u.category === "cardio")).toBeGreaterThanOrEqual(6);
  expect(anzahl((u) => u.category === "mobility" || u.category === "dehnen")).toBeGreaterThanOrEqual(6);
});

test.each(["brust", "ruecken", "schulter", "beine", "gesaess", "rumpf"])("Hauptmuskelgruppe %s kommt mindestens dreimal vor", (gruppe) => {
  expect(anzahl((u) => u.muskeln.includes(gruppe))).toBeGreaterThanOrEqual(3);
});

test("Arme (Bizeps oder Trizeps) kommen mindestens dreimal vor", () => {
  expect(anzahl((u) => u.muskeln.includes("bizeps") || u.muskeln.includes("trizeps"))).toBeGreaterThanOrEqual(3);
});
