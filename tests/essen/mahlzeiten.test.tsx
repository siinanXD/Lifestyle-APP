import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import EssenPage from "../../app/(app)/essen/page";
import { fuehreAbfrage, setzeZurueck } from "../../lib/demo/db";
import { demoServerClient } from "../../lib/demo/server";
import { amTag, pruefeMahlzeit, summe, zuletztGegessen, type Eingabe } from "../../lib/essen/mahlzeiten";
import { setzeQueue, synchronisiere } from "../../lib/offline/sync";

const requireConsent = vi.hoisted(() => vi.fn());
vi.mock("../../lib/consent/require-consent", () => ({ requireConsent }));
vi.mock("../../lib/supabase/client", () => ({ createClient: () => demoServerClient() }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => demoServerClient() }));

// Lokale Zeit wie auf dem Gerät: unabhängig von der Zeitzone des Testlaufs.
const lokal = (tag: number, h: number, m: number) => new Date(2026, 10, tag, h, m).toISOString();
const m = (werte: Partial<{ kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }>) => ({
  kcal: null, protein_g: null, carbs_g: null, fat_g: null, ...werte,
});
const gueltig: Eingabe = { name: " Haferbrei ", menge: " 1 Schale ", kcal: "350", eiweiss: "12,5", kohlenhydrate: "55", fett: "7.25", zeit: new Date(2026, 10, 10, 8, 30) };
const fehler = (e: Partial<Eingabe>) => {
  const r = pruefeMahlzeit({ ...gueltig, ...e });
  return r.ok ? [] : r.fehler;
};

describe("summe", () => {
  test("leere Liste: alles null, nicht 0", () => expect(summe([])).toEqual({ kcal: null, protein_g: null, carbs_g: null, fat_g: null }));
  test("fehlende Werte zählen nicht, nur vorhandene", () => {
    expect(summe([m({ kcal: 300, protein_g: 20 }), m({ kcal: 450 }), m({ protein_g: 10.5, fat_g: 0 })])).toEqual({ kcal: 750, protein_g: 30.5, carbs_g: null, fat_g: 0 });
  });
  test("Dezimalwerte als Text aus der Datenbank werden als Zahl addiert", () => {
    expect(summe([m({ protein_g: "12.5" as never }), m({ protein_g: "0.2" as never })]).protein_g).toBe(12.7);
  });
});

describe("amTag", () => {
  test("Tagesgrenze ist 00:00 lokal: 23:59 zählt zum Vortag, 00:01 zum neuen Tag; früheste zuerst", () => {
    const liste = [{ id: "c", eaten_at: lokal(10, 18, 0) }, { id: "a", eaten_at: lokal(9, 23, 59) }, { id: "b", eaten_at: lokal(10, 0, 1) }];
    expect(amTag(liste, new Date(2026, 10, 10, 12, 0)).map((x) => x.id)).toEqual(["b", "c"]);
    expect(amTag(liste, new Date(2026, 10, 9, 12, 0)).map((x) => x.id)).toEqual(["a"]);
  });
});

describe("pruefeMahlzeit", () => {
  test("gültige Eingabe: getrimmt, Komma oder Punkt, Gramm auf eine Nachkommastelle", () => {
    expect(pruefeMahlzeit(gueltig)).toEqual({
      ok: true,
      werte: { eaten_at: gueltig.zeit.toISOString(), name: "Haferbrei", amount_note: "1 Schale", kcal: 350, protein_g: 12.5, carbs_g: 55, fat_g: 7.3 },
    });
  });
  test("freiwillige Felder leer: null", () => {
    expect(pruefeMahlzeit({ ...gueltig, menge: "", kcal: "", eiweiss: "", kohlenhydrate: "", fett: "" })).toMatchObject({
      ok: true,
      werte: { amount_note: null, kcal: null, protein_g: null, carbs_g: null, fat_g: null },
    });
  });
  test.each(["-5", "5001", "12,5", "abc"])("kcal „%s“ wird abgelehnt", (kcal) => expect(fehler({ kcal })).toEqual(["kcal"]));
  test.each(["-1", "1001", "abc"])("Eiweiß „%s“ wird abgelehnt", (eiweiss) => expect(fehler({ eiweiss })).toEqual(["eiweiss"]));
  test("leerer Name, zu lange Menge und mehrere Fehler zusammen", () => {
    expect(fehler({ name: "  " })).toEqual(["name"]);
    expect(fehler({ menge: "x".repeat(61) })).toEqual(["menge"]);
    expect(fehler({ name: "", fett: "-2", kohlenhydrate: "2000" })).toEqual(["name", "kohlenhydrate", "fett"]);
  });
});

describe("zuletztGegessen", () => {
  test("höchstens 10 eindeutige Namen, neueste zuerst, Groß-/Kleinschreibung egal", () => {
    const liste = Array.from({ length: 14 }, (_, i) => ({ name: `Gericht ${i}`, eaten_at: lokal(1, 8, i) }));
    liste.push({ name: "gericht 13", eaten_at: lokal(2, 9, 0) });
    const namen = zuletztGegessen(liste).map((x) => x.name);
    expect(namen).toHaveLength(10);
    expect(namen[0]).toBe("gericht 13");
    expect(namen).not.toContain("Gericht 13");
    expect(namen[1]).toBe("Gericht 12");
  });
});

// Seite gegen den Demo-Speicher (lib/demo) und die echte Offline-Warteschlange im Speicher.
describe("Seite /essen", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "on");
    setzeZurueck();
    setzeQueue();
    requireConsent.mockResolvedValue(undefined);
  });
  afterEach(async () => {
    cleanup();
    await synchronisiere();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });
  const zeilen = () => fuehreAbfrage("meals", [{ m: "select", a: ["*"] }]).data as Record<string, unknown>[];
  const lege = (zeile: object) => fuehreAbfrage("meals", [{ m: "insert", a: [zeile] }]);
  const tippe = (label: string, wert: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: wert } });
  const liste = () => within(screen.getByRole("list", { name: "Mahlzeiten" }));

  test("ohne Einwilligung B wird umgeleitet und nichts geladen", async () => {
    requireConsent.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(EssenPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(requireConsent).toHaveBeenCalledWith("B", "/essen");
  });

  test("leerer Tag, Hinweis und Link zu Wasser", async () => {
    render(await EssenPage());
    expect(screen.getByText("Für diesen Tag ist nichts eingetragen.")).toBeTruthy();
    expect(screen.getByText(/kein Ersatz für ärztliche oder ernährungsberatende Beratung/)).toBeTruthy();
    expect(within(screen.getByRole("navigation", { name: "Mehr erfassen" })).getByRole("link", { name: "Wasser" }).getAttribute("href")).toBe("/essen/wasser");
  });

  test("Hinzufügen zeigt die Mahlzeit sofort, speichert sie und zählt nur vorhandene Werte zusammen", async () => {
    render(await EssenPage());
    tippe("Was hast du gegessen?", "Haferbrei");
    tippe("Menge (freiwillig)", "1 Schale");
    tippe("Kalorien in kcal (freiwillig)", "350");
    tippe("Eiweiß in g (freiwillig)", "12,5");
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    expect(await screen.findByText("Haferbrei (1 Schale)")).toBeTruthy();
    tippe("Was hast du gegessen?", "Apfel");
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    await liste().findByText("Apfel");
    expect(screen.getByTestId("summe").textContent).toBe("Summe der Angaben: 350 kcal · Eiweiß 12,5 g");
    await vi.waitFor(() => expect(zeilen()).toHaveLength(2));
    expect(zeilen().find((z) => z.name === "Haferbrei")).toMatchObject({ amount_note: "1 Schale", kcal: 350, protein_g: 12.5, carbs_g: null });
  });

  test("ungültige Werte (−5 kcal) werden abgelehnt: Meldung, nichts gespeichert", async () => {
    render(await EssenPage());
    tippe("Was hast du gegessen?", "Haferbrei");
    tippe("Kalorien in kcal (freiwillig)", "-5");
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    expect((await screen.findByRole("alert")).textContent).toContain("0 bis 5000");
    await synchronisiere();
    expect(zeilen()).toEqual([]);
  });

  test("Ändern überschreibt dieselbe Zeile, Löschen entfernt sie", async () => {
    lege({ id: "m1", user_id: "u", name: "Nudeln", kcal: 600, eaten_at: new Date().toISOString() });
    render(await EssenPage());
    fireEvent.click(liste().getByRole("button", { name: "Nudeln ändern" }));
    expect((screen.getByLabelText("Kalorien in kcal (freiwillig)") as HTMLInputElement).value).toBe("600");
    tippe("Kalorien in kcal (freiwillig)", "650");
    fireEvent.click(screen.getByRole("button", { name: "Änderung speichern" }));
    await vi.waitFor(() => expect(screen.getByTestId("summe").textContent).toBe("Summe der Angaben: 650 kcal"));
    await vi.waitFor(() => expect(zeilen()).toMatchObject([{ id: "m1", kcal: 650 }]));
    fireEvent.click(liste().getByRole("button", { name: "Nudeln löschen" }));
    await vi.waitFor(() => expect(screen.getByText("Für diesen Tag ist nichts eingetragen.")).toBeTruthy());
    await vi.waitFor(() => expect(zeilen()).toEqual([]));
  });

  test("Datumswechsel: gestern zeigt die Mahlzeit von gestern, „Vor“ ist heute gesperrt", async () => {
    const gestern = new Date();
    gestern.setDate(gestern.getDate() - 1);
    gestern.setHours(12, 0, 0, 0);
    lege({ id: "g1", user_id: "u", name: "Suppe", eaten_at: gestern.toISOString() });
    render(await EssenPage());
    expect((screen.getByRole("button", { name: "Vor" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("Suppe", { selector: "span" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
    expect(liste().getByText("Suppe")).toBeTruthy();
    expect(screen.getByTestId("summe").textContent).toBe("Für diesen Tag gibt es keine Nährwert-Angaben.");
    expect((screen.getByRole("button", { name: "Vor" }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("Schnellwahl „Zuletzt gegessen“ füllt das Formular mit den früheren Werten", async () => {
    lege({ id: "m1", user_id: "u", name: "Nudeln", amount_note: "1 Teller", kcal: 600, eaten_at: new Date(Date.now() - 86400000).toISOString() });
    render(await EssenPage());
    fireEvent.click(within(screen.getByRole("group", { name: "Zuletzt gegessen" })).getByRole("button", { name: "Nudeln" }));
    expect((screen.getByLabelText("Was hast du gegessen?") as HTMLInputElement).value).toBe("Nudeln");
    expect((screen.getByLabelText("Menge (freiwillig)") as HTMLInputElement).value).toBe("1 Teller");
    expect((screen.getByLabelText("Kalorien in kcal (freiwillig)") as HTMLInputElement).value).toBe("600");
  });
});
