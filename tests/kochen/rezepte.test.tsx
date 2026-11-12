import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import KochenPage from "../../app/(app)/kochen/page";
import RezeptPage from "../../app/(app)/kochen/rezept/[slug]/page";
import { fuehreAbfrage, setzeZurueck } from "../../lib/demo/db";
import { demoServerClient } from "../../lib/demo/server";
import { KUECHENGERAETE } from "../../lib/kochen/geraete";
import { EINHEITEN } from "../../lib/kochen/kueche";
import { FILTER, hatKennzeichen, REZEPTE, schlageVor, type Rezept } from "../../lib/kochen/rezepte";
import { istZutat } from "../../lib/kochen/zutaten";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => demoServerClient() }));

const r = (slug: string, werte: Partial<Rezept>): Rezept => ({
  slug, name: slug, minuten: 30, portionen: 2, geraete: ["herd"], kost: "alles", kcal: 500, protein_g: 20, zutaten: [], schritte: ["x", "y"], ...werte,
});
const NUDELN = r("nudeln", { kost: "vegan", minuten: 20, zutaten: [{ key: "nudeln" }, { key: "passierte_tomaten" }, { key: "salz" }, { key: "oel" }, { key: "knoblauch", optional: true }] });
const HAEHNCHEN = r("haehnchen", { geraete: ["airfryer"], protein_g: 40, zutaten: [{ key: "haehnchenbrust" }, { key: "pommes" }] });
const OMELETT = r("omelett", { kost: "vegetarisch", minuten: 15, protein_g: 26, kcal: 380, zutaten: [{ key: "ei" }, { key: "paprika" }] });
const SAMMLUNG = [NUDELN, HAEHNCHEN, OMELETT];
const slugs = (liste: { rezept: Rezept }[]) => liste.map((v) => v.rezept.slug);

describe("schlageVor", () => {
  test("fehlendes Gerät schließt das Rezept aus", () => {
    expect(slugs(schlageVor(SAMMLUNG, ["haehnchenbrust", "pommes"], ["herd"]))).not.toContain("haehnchen");
    expect(slugs(schlageVor(SAMMLUNG, ["haehnchenbrust", "pommes"], ["herd", "airfryer"]))[0]).toBe("haehnchen");
  });
  test("alles da: keine fehlenden Zutaten; Grundzutaten und freiwillige Zutaten zählen nicht als fehlend", () => {
    expect(schlageVor([NUDELN], ["nudeln", "passierte_tomaten"], ["herd"])).toEqual([{ rezept: NUDELN, fehlend: [] }]);
  });
  test("es fehlt wenig: die Liste nennt genau das Fehlende; sortiert nach Anzahl, dann Zeit", () => {
    const v = schlageVor(SAMMLUNG, ["ei", "nudeln"], ["herd", "airfryer"]);
    expect(v.map((x) => [x.rezept.slug, x.fehlend])).toEqual([
      ["omelett", ["paprika"]],
      ["nudeln", ["passierte_tomaten"]],
      ["haehnchen", ["haehnchenbrust", "pommes"]],
    ]);
  });
  test("leerer Vorrat: alle Rezepte mit vorhandenen Geräten, jeweils alles Nötige fehlt", () => {
    const v = schlageVor(SAMMLUNG, [], ["herd"]);
    expect(slugs(v)).toEqual(["omelett", "nudeln"]);
    expect(v[1].fehlend).toEqual(["nudeln", "passierte_tomaten"]);
  });
  test("Filter vegetarisch, vegan, schnell, Fitness; mehrere Filter gelten zusammen", () => {
    const mit = (...f: Parameters<typeof schlageVor>[3] & string[]) => slugs(schlageVor(SAMMLUNG, [], ["herd", "airfryer"], f as never)).sort();
    expect(mit("vegetarisch")).toEqual(["nudeln", "omelett"]);
    expect(mit("vegan")).toEqual(["nudeln"]);
    expect(mit("schnell")).toEqual(["nudeln", "omelett"]);
    expect(mit("fitness")).toEqual(["haehnchen", "omelett"]);
    expect(mit("fitness", "vegetarisch")).toEqual(["omelett"]);
    expect(mit("vegan", "fitness")).toEqual([]);
  });
  test("ohne Geräte gehen nur Rezepte ohne Gerät", () => {
    expect(slugs(schlageVor([...SAMMLUNG, r("quark", { geraete: [] })], [], []))).toEqual(["quark"]);
  });
});

describe("Rezeptsammlung", () => {
  test("mindestens 24 Rezepte mit eindeutigem Schlüssel und Namen", () => {
    expect(REZEPTE.length).toBeGreaterThanOrEqual(24);
    expect(new Set(REZEPTE.map((x) => x.slug)).size).toBe(REZEPTE.length);
    expect(new Set(REZEPTE.map((x) => x.name)).size).toBe(REZEPTE.length);
    for (const x of REZEPTE) expect(x.slug, x.slug).toMatch(/^[a-z0-9-]{1,60}$/);
  });
  test("jede Zutat, jede Einheit und jedes Gerät ist bekannt; keine Zutat doppelt", () => {
    for (const x of REZEPTE) {
      for (const g of x.geraete) expect(g in KUECHENGERAETE, `${x.slug}: ${g}`).toBe(true);
      for (const z of x.zutaten) {
        expect(istZutat(z.key), `${x.slug}: ${z.key}`).toBe(true);
        if (z.einheit) expect(z.einheit in EINHEITEN, `${x.slug}: ${z.einheit}`).toBe(true);
      }
      expect(new Set(x.zutaten.map((z) => z.key)).size, x.slug).toBe(x.zutaten.length);
      expect(x.zutaten.some((z) => !z.optional), x.slug).toBe(true);
      expect(x.schritte.length, x.slug).toBeGreaterThanOrEqual(2);
    }
  });
  test("vegane Rezepte sind auch vegetarisch und enthalten nichts Tierisches", () => {
    const tierisch = ["ei", "haehnchenbrust", "hackfleisch", "lachs", "thunfisch", "magerquark", "skyr", "joghurt", "huettenkaese", "kaese", "mozzarella", "feta", "parmesan", "schinken", "speck", "milch", "butter", "sahne", "frischkaese", "honig"];
    const fleischFisch = ["haehnchenbrust", "hackfleisch", "lachs", "thunfisch", "schinken", "speck"];
    for (const x of REZEPTE) {
      const keys = x.zutaten.map((z) => z.key as string);
      if (x.kost === "vegan") {
        expect(hatKennzeichen(x, "vegetarisch"), x.slug).toBe(true);
        expect(keys.filter((k) => tierisch.includes(k)), x.slug).toEqual([]);
      }
      if (x.kost === "vegetarisch") expect(keys.filter((k) => fleischFisch.includes(k)), x.slug).toEqual([]);
    }
  });
  test("jeder Filter hat mindestens drei Rezepte; Werte sind plausibel", () => {
    for (const f of Object.keys(FILTER) as (keyof typeof FILTER)[]) expect(REZEPTE.filter((x) => hatKennzeichen(x, f)).length, f).toBeGreaterThanOrEqual(3);
    for (const x of REZEPTE) {
      expect(x.minuten, x.slug).toBeGreaterThan(0);
      expect(x.kcal, x.slug).toBeGreaterThan(100);
      expect(x.kcal, x.slug).toBeLessThan(1200);
      expect(x.protein_g * 4, x.slug).toBeLessThan(x.kcal);
    }
  });
  test("keine Heil- oder Diagnoseaussagen in Namen und Schritten", () => {
    for (const x of REZEPTE) expect([x.name, ...x.schritte].join(" "), x.slug).not.toMatch(/diagnos|heil|therap|abnehm|entgift|gesund/i);
  });
});

// Seiten gegen den Demo-Speicher (lib/demo).
describe("Seiten", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "on");
    setzeZurueck();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });
  const vorrat = (...keys: string[]) => keys.forEach((k) => fuehreAbfrage("pantry_items", [{ m: "insert", a: [{ user_id: "u", name: k, ingredient_key: k }] }]));
  const geraete = (...arten: string[]) => arten.forEach((kind) => fuehreAbfrage("kitchen_appliances", [{ m: "insert", a: [{ user_id: "u", kind }] }]));
  const gruppe = (name: string) => within(screen.getByRole("region", { name }));

  test("ohne Geräte und Vorrat: Hinweise, und nur Rezepte ohne Gerät werden vorgeschlagen", async () => {
    render(await KochenPage());
    expect(screen.getByText(/noch keine Küchengeräte eingetragen/)).toBeTruthy();
    expect(screen.getByText(/Dein Vorrat ist noch leer/)).toBeTruthy();
    expect(gruppe("Alles da").getByText("Dafür ist gerade kein Rezept vollständig da.")).toBeTruthy();
    expect(gruppe("Es fehlt wenig").getByRole("link", { name: "Magerquark mit Beeren und Haferflocken" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Nudeln Bolognese" })).toBeNull();
  });

  test("„Alles da“ und „Es fehlt wenig“ mit der Liste des Fehlenden", async () => {
    geraete("herd", "airfryer");
    vorrat("haehnchenbrust", "pommes", "nudeln", "zwiebel");
    render(await KochenPage());
    expect(gruppe("Alles da").getByRole("link", { name: "Hähnchen und Pommes aus dem Airfryer" }).getAttribute("href")).toBe("/kochen/rezept/airfryer-haehnchen-pommes");
    const wenig = gruppe("Es fehlt wenig");
    const karte = within(wenig.getByRole("link", { name: "Nudeln mit Tomatensoße" }).closest("li")!);
    expect(karte.getByText("Es fehlt: Passierte Tomaten")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Ofengemüse mit Feta" })).toBeNull(); // kein Backofen
  });

  test("Filter ändern die Liste", async () => {
    geraete("herd", "airfryer", "ofen");
    vorrat("haehnchenbrust", "pommes", "nudeln", "passierte_tomaten", "zwiebel");
    render(await KochenPage());
    expect(gruppe("Alles da").getAllByRole("link")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Vegan" }));
    expect(gruppe("Alles da").getAllByRole("link").map((l) => l.textContent)).toEqual(["Nudeln mit Tomatensoße"]);
    fireEvent.click(screen.getByRole("button", { name: "Fitness" }));
    expect(gruppe("Alles da").getByText("Dafür ist gerade kein Rezept vollständig da.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Vegan" }));
    expect(gruppe("Alles da").getAllByRole("link").map((l) => l.textContent)).toEqual(["Hähnchen und Pommes aus dem Airfryer"]);
  });

  test("Detail zeigt Zutaten mit „da“ und „fehlt“, Schritte, Nährwert-Schätzung und ein fehlendes Gerät", async () => {
    geraete("herd");
    vorrat("haehnchenbrust");
    render(await RezeptPage({ params: Promise.resolve({ slug: "airfryer-haehnchen-pommes" }) }));
    expect(screen.getByRole("heading", { level: 1, name: "Hähnchen und Pommes aus dem Airfryer" })).toBeTruthy();
    const zutaten = within(screen.getByRole("region", { name: "Zutaten" }));
    expect(zutaten.getByText(/300 g Hähnchenbrust – da/)).toBeTruthy();
    expect(zutaten.getByText(/300 g Pommes – fehlt/)).toBeTruthy();
    expect(zutaten.getByText("Es fehlt: Pommes")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toContain("Airfryer");
    expect(within(screen.getByRole("region", { name: "Zubereitung" })).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText(/Je Portion etwa 560 kcal und 40 g Eiweiß/)).toBeTruthy();
    expect(screen.getByText(/grobe Schätzungen/)).toBeTruthy();
  });

  test("unbekanntes Rezept liefert 404", async () => {
    await expect(RezeptPage({ params: Promise.resolve({ slug: "gibt-es-nicht" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
