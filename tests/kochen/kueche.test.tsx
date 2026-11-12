import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import KuechengeraetePage from "../../app/(app)/kochen/geraete/page";
import VorratPage from "../../app/(app)/kochen/vorrat/page";
import { fuehreAbfrage, setzeZurueck } from "../../lib/demo/db";
import { demoServerClient } from "../../lib/demo/server";
import { pruefeVorrat, type Eingabe } from "../../lib/kochen/kueche";

vi.mock("../../lib/supabase/client", () => ({ createClient: () => demoServerClient() }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => demoServerClient() }));

const zeilen = (tabelle: string) => fuehreAbfrage(tabelle, [{ m: "select", a: ["*"] }]).data as Record<string, unknown>[];
const gueltig: Eingabe = { name: " Eier ", menge: "6", einheit: "stueck", ort: "kuehlschrank", haltbarBis: "2026-12-01" };
const fehler = (e: Partial<Eingabe>) => {
  const r = pruefeVorrat({ ...gueltig, ...e });
  return r.ok ? [] : r.fehler;
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "on");
  setzeZurueck();
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("pruefeVorrat", () => {
  test("gültig: getrimmt, Zutat erkannt, Komma als Dezimalzeichen", () => {
    expect(pruefeVorrat({ ...gueltig, menge: "1,5", einheit: "kg" })).toEqual({
      ok: true,
      werte: { name: "Eier", ingredient_key: "ei", amount: 1.5, unit: "kg", location: "kuehlschrank", best_before: "2026-12-01" },
    });
  });
  test("freiwillige Felder leer; unbekannte Zutat bleibt ohne Schlüssel", () => {
    expect(pruefeVorrat({ name: "Spülmittel", menge: "", einheit: "", ort: "vorrat", haltbarBis: "" })).toEqual({
      ok: true,
      werte: { name: "Spülmittel", ingredient_key: null, amount: null, unit: null, location: "vorrat", best_before: null },
    });
  });
  test.each(["-1", "100001", "viel"])("Menge „%s“ wird abgelehnt", (menge) => expect(fehler({ menge })).toEqual(["menge"]));
  test("leerer Name, unbekannte Einheit, unbekannter Ort, kaputtes Datum", () => {
    expect(fehler({ name: " " })).toEqual(["name"]);
    expect(fehler({ einheit: "tasse" })).toEqual(["einheit"]);
    expect(fehler({ ort: "keller" })).toEqual(["ort"]);
    expect(fehler({ haltbarBis: "morgen" })).toEqual(["haltbarBis"]);
  });
});

describe("Seite /kochen/geraete", () => {
  const haken = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement;

  test("Gerät anwählen speichert es sofort, abwählen entfernt es", async () => {
    render(await KuechengeraetePage());
    expect(haken("Backofen").checked).toBe(false);
    fireEvent.click(haken("Backofen"));
    await vi.waitFor(() => expect(haken("Backofen").checked).toBe(true));
    fireEvent.click(haken("Airfryer (Heißluftfritteuse)"));
    await vi.waitFor(() => expect(zeilen("kitchen_appliances").map((z) => z.kind).sort()).toEqual(["airfryer", "ofen"]));
    fireEvent.click(haken("Backofen"));
    await vi.waitFor(() => expect(haken("Backofen").checked).toBe(false));
    expect(zeilen("kitchen_appliances").map((z) => z.kind)).toEqual(["airfryer"]);
  });

  test("gespeicherte Geräte sind angehakt; das Modell wird beim Verlassen des Felds gespeichert, ohne zweite Zeile", async () => {
    fuehreAbfrage("kitchen_appliances", [{ m: "insert", a: [{ user_id: "00000000-0000-4000-8000-000000000001", kind: "mikrowelle" }] }]);
    render(await KuechengeraetePage());
    expect(haken("Mikrowelle").checked).toBe(true);
    const modell = screen.getByLabelText("Modell von Mikrowelle (freiwillig)");
    fireEvent.change(modell, { target: { value: "Testgerät 800 W" } });
    fireEvent.blur(modell);
    await vi.waitFor(() => expect(zeilen("kitchen_appliances")).toMatchObject([{ kind: "mikrowelle", model: "Testgerät 800 W" }]));
  });
});

describe("Seite /kochen/vorrat", () => {
  const tippe = (label: string, wert: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: wert } });

  test("leerer Vorrat; Hinzufügen zeigt den Eintrag unter seinem Ort und speichert ihn mit Zutaten-Schlüssel", async () => {
    render(await VorratPage());
    expect(screen.getByText(/Noch nichts eingetragen/)).toBeTruthy();
    tippe("Was hast du da?", "Eier");
    tippe("Menge (freiwillig)", "6");
    tippe("Einheit", "stueck");
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    expect(await within(await screen.findByRole("region", { name: "Kühlschrank" })).findByText("Eier · 6 Stück")).toBeTruthy();
    expect(zeilen("pantry_items")).toMatchObject([{ name: "Eier", ingredient_key: "ei", amount: 6, unit: "stueck", location: "kuehlschrank" }]);
  });

  test("unbekannte Zutat wird gespeichert und als „zählt nicht für Rezepte“ markiert; Ort Gefrierfach", async () => {
    render(await VorratPage());
    tippe("Was hast du da?", "Eiswürfel");
    tippe("Wo liegt es?", "gefrierfach");
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    const fach = within(await screen.findByRole("region", { name: "Gefrierfach" }));
    expect(fach.getByText("Eiswürfel")).toBeTruthy();
    expect(fach.getByText(/zählt nicht für Rezepte/)).toBeTruthy();
  });

  test("ungültige Menge wird abgelehnt: Meldung, nichts gespeichert", async () => {
    render(await VorratPage());
    tippe("Was hast du da?", "Milch");
    tippe("Menge (freiwillig)", "-2");
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    expect((await screen.findByRole("alert")).textContent).toContain("0 bis 100000");
    expect(zeilen("pantry_items")).toEqual([]);
  });

  test("Ändern überschreibt dieselbe Zeile, Löschen entfernt sie", async () => {
    fuehreAbfrage("pantry_items", [{ m: "insert", a: [{ id: "v1", user_id: "u", name: "Milch", ingredient_key: "milch", amount: 1, unit: "l", best_before: "2026-11-20" }] }]);
    render(await VorratPage());
    expect(screen.getByText("Milch · 1 l")).toBeTruthy();
    expect(screen.getByText("haltbar bis 20.11.2026")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Milch ändern" }));
    tippe("Menge (freiwillig)", "0,5");
    fireEvent.click(screen.getByRole("button", { name: "Änderung speichern" }));
    expect(await screen.findByText("Milch · 0,5 l")).toBeTruthy();
    expect(zeilen("pantry_items")).toMatchObject([{ id: "v1", amount: 0.5 }]);
    fireEvent.click(screen.getByRole("button", { name: "Milch löschen" }));
    await vi.waitFor(() => expect(zeilen("pantry_items")).toEqual([]));
    expect(screen.queryByText(/Milch ·/)).toBeNull();
  });
});

test("Speicherfehler beim Gerät: Der Haken springt zurück und es gibt eine Meldung", async () => {
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "on");
  setzeZurueck();
  const kueche = await import("../../lib/kochen/kueche");
  const spion = vi.spyOn(kueche, "speichereGeraet").mockResolvedValue({ ok: false, fehler: "netz" });
  render(await KuechengeraetePage());
  const ofen = screen.getByRole("checkbox", { name: "Backofen" }) as HTMLInputElement;
  fireEvent.click(ofen);
  expect((await screen.findByRole("alert")).textContent).toContain("nicht geklappt");
  expect(ofen.checked).toBe(false);
  expect(zeilen("kitchen_appliances")).toEqual([]);
  spion.mockRestore();
  cleanup();
  vi.unstubAllEnvs();
});
