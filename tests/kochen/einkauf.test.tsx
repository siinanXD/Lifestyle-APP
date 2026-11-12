import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import EinkaufPage from "../../app/(app)/kochen/einkauf/page";
import RezeptPage from "../../app/(app)/kochen/rezept/[slug]/page";
import { fuehreAbfrage, setzeZurueck } from "../../lib/demo/db";
import { demoServerClient } from "../../lib/demo/server";
import { fasseZusammen, pruefeEinkauf, type Einkaufswerte } from "../../lib/kochen/einkauf";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("../../lib/supabase/client", () => ({ createClient: () => demoServerClient() }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => demoServerClient() }));

const zeilen = (tabelle: string) => fuehreAbfrage(tabelle, [{ m: "select", a: ["*"] }]).data as Record<string, unknown>[];
const e = (name: string, amount: number | null = null, unit: Einkaufswerte["unit"] = null, ingredient_key: string | null = name): Einkaufswerte => ({ name, ingredient_key, amount, unit });
const kurz = (liste: Record<string, unknown>[]) => liste.map((z) => [z.name, z.amount === null ? null : Number(z.amount), z.unit, z.done]).sort();

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "on");
  setzeZurueck();
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("fasseZusammen", () => {
  test("gleiche Zutat und Einheit wird addiert", () => {
    expect(fasseZusammen([e("reis", 150, "g"), e("reis", 200, "g"), e("reis", 0.25, "g")])).toEqual([e("reis", 350.25, "g")]);
  });
  test("andere Einheit bleibt getrennt", () => {
    expect(fasseZusammen([e("reis", 150, "g"), e("reis", 1, "packung")])).toEqual([e("reis", 150, "g"), e("reis", 1, "packung")]);
  });
  test("ohne Menge bleibt ohne Menge und wird nicht doppelt", () => {
    expect(fasseZusammen([e("salat"), e("salat"), e("salat", 1, "stueck")])).toEqual([e("salat"), e("salat", 1, "stueck")]);
  });
  test("unbekannte Zutaten nach Namen, ohne Groß-/Kleinschreibung; die erste Zeile behält ihre Felder", () => {
    const r = fasseZusammen([{ ...e("Spülmittel", 1, "stueck", null), id: "a" }, { ...e("spülmittel ", 2, "stueck", null), id: "b" }]);
    expect(r).toEqual([{ ...e("Spülmittel", 3, "stueck", null), id: "a" }]);
  });
  test("ändert die Eingabe nicht", () => {
    const eingabe = [e("reis", 150, "g"), e("reis", 200, "g")];
    fasseZusammen(eingabe);
    expect(eingabe[0].amount).toBe(150);
  });
});

test("pruefeEinkauf: gültig mit erkannter Zutat; leerer Name und kaputte Menge werden abgelehnt", () => {
  expect(pruefeEinkauf({ name: " Eier ", menge: "6", einheit: "stueck" })).toEqual({ ok: true, werte: { name: "Eier", ingredient_key: "ei", amount: 6, unit: "stueck" } });
  expect(pruefeEinkauf({ name: "", menge: "viel", einheit: "" })).toEqual({ ok: false, fehler: ["name", "menge"] });
});

describe("Rezept → Einkaufsliste", () => {
  const rezept = () => RezeptPage({ params: Promise.resolve({ slug: "haehnchen-reis-pfanne" }) });

  test("übernimmt nur Fehlendes, mit Menge aus dem Rezept; ein zweites Mal addiert statt zu verdoppeln", async () => {
    fuehreAbfrage("pantry_items", [{ m: "insert", a: [{ user_id: "u", name: "Reis", ingredient_key: "reis" }] }]);
    render(await rezept());
    fireEvent.click(screen.getByRole("button", { name: "Fehlendes auf die Einkaufsliste" }));
    expect((await screen.findByRole("status")).textContent).toContain("2 Zutaten stehen auf der Einkaufsliste.");
    expect(screen.getByRole("link", { name: "Zur Einkaufsliste" }).getAttribute("href")).toBe("/kochen/einkauf");
    expect(kurz(zeilen("shopping_items"))).toEqual([["Gemüsemischung", 300, "g", false], ["Hähnchenbrust", 300, "g", false]]);
    expect(zeilen("shopping_items").every((z) => z.recipe_slug === "haehnchen-reis-pfanne")).toBe(true);

    cleanup();
    render(await rezept());
    fireEvent.click(screen.getByRole("button", { name: "Fehlendes auf die Einkaufsliste" }));
    await screen.findByRole("status");
    expect(kurz(zeilen("shopping_items"))).toEqual([["Gemüsemischung", 600, "g", false], ["Hähnchenbrust", 600, "g", false]]);
  });

  test("ist alles da, gibt es keinen Knopf", async () => {
    for (const k of ["haehnchenbrust", "reis", "gemuesemischung"]) fuehreAbfrage("pantry_items", [{ m: "insert", a: [{ user_id: "u", name: k, ingredient_key: k }] }]);
    render(await rezept());
    expect(screen.queryByRole("button", { name: "Fehlendes auf die Einkaufsliste" })).toBeNull();
  });
});

describe("Seite /kochen/einkauf", () => {
  const fuelle = (name: string, menge = "", einheit = "") => {
    fireEvent.change(screen.getByLabelText("Was brauchst du?"), { target: { value: name } });
    fireEvent.change(screen.getByLabelText("Menge (freiwillig)"), { target: { value: menge } });
    fireEvent.change(screen.getByLabelText("Einheit"), { target: { value: einheit } });
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
  };
  const haken = (name: RegExp) => screen.getByRole("checkbox", { name }) as HTMLInputElement;

  test("leer; eigener Eintrag von Hand; gleicher Eintrag wird zusammengefasst; ungültig zeigt Fehler", async () => {
    render(await EinkaufPage());
    expect(screen.getByText(/Die Liste ist leer/)).toBeTruthy();
    fuelle("Milch", "1", "l");
    await vi.waitFor(() => expect(haken(/Milch · 1 l/)).toBeTruthy());
    fuelle("Milch", "0,5", "l");
    await vi.waitFor(() => expect(haken(/Milch · 1,5 l/)).toBeTruthy());
    expect(zeilen("shopping_items")).toHaveLength(1);
    fuelle("", "viel");
    expect(screen.getByRole("alert").textContent).toContain("Bitte gib an");
    expect(zeilen("shopping_items")).toHaveLength(1);
  });

  test("Abhaken, Löschen und „in den Vorrat legen“ verschieben die Einträge", async () => {
    for (const [name, key] of [["Milch", "milch"], ["Brot", "brot"], ["Spülmittel", null]])
      fuehreAbfrage("shopping_items", [{ m: "insert", a: [{ user_id: "u", name, ingredient_key: key, amount: 1, unit: "stueck" }] }]);
    render(await EinkaufPage());
    fireEvent.click(haken(/Milch/));
    await vi.waitFor(() => expect(within(screen.getByRole("region", { name: "Erledigt" })).getByRole("checkbox", { name: /Milch/ })).toBeTruthy());
    fireEvent.click(haken(/Brot/));
    await vi.waitFor(() => expect(haken(/Brot/).checked).toBe(true));
    fireEvent.click(haken(/Brot/)); // wieder zurück
    await vi.waitFor(() => expect(haken(/Brot/).checked).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Spülmittel löschen" }));
    await vi.waitFor(() => expect(screen.queryByRole("checkbox", { name: /Spülmittel/ })).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Erledigtes in den Vorrat legen" }));
    expect((await screen.findByRole("status")).textContent).toContain("1 Eintrag liegt jetzt im Vorrat");
    expect(kurz(zeilen("shopping_items"))).toEqual([["Brot", 1, "stueck", false]]);
    expect(zeilen("pantry_items").map((z) => [z.name, z.ingredient_key, Number(z.amount), z.unit, z.location, z.source])).toEqual([["Milch", "milch", 1, "stueck", "kuehlschrank", "einkauf"]]);
    expect(screen.queryByRole("region", { name: "Erledigt" })).toBeNull();
  });
});
