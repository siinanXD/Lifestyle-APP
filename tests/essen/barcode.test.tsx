import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import EssenPage from "../../app/(app)/essen/page";
import { fuehreAbfrage, setzeZurueck } from "../../lib/demo/db";
import { demoServerClient } from "../../lib/demo/server";
import { MELDUNGEN, skaliere } from "../../lib/essen/barcode";
import { setzeQueue, synchronisiere } from "../../lib/offline/sync";

vi.mock("../../lib/consent/require-consent", () => ({ requireConsent: async () => undefined }));
vi.mock("../../lib/supabase/client", () => ({ createClient: () => demoServerClient() }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => demoServerClient() }));

const NUTELLA = { code: "3017624010701", name: "Nutella (Ferrero)", menge: "400 g", kcal100g: 539, protein100g: 6.3, carbs100g: 57.5, fat100g: null };

describe("skaliere", () => {
  test("100 g = unverändert", () => expect(skaliere(NUTELLA, 100)).toEqual({ kcal: 539, protein_g: 6.3, carbs_g: 57.5, fat_g: null }));
  test("250 g; fehlende Werte bleiben null", () => expect(skaliere(NUTELLA, 250)).toEqual({ kcal: 1348, protein_g: 15.8, carbs_g: 143.8, fat_g: null }));
  test("Rundung: kcal ganzzahlig, Gramm auf eine Nachkommastelle", () => {
    expect(skaliere({ kcal100g: 372, protein100g: 13.55, carbs100g: 58.7, fat100g: 7 }, 33)).toEqual({ kcal: 123, protein_g: 4.5, carbs_g: 19.4, fat_g: 2.3 });
  });
});

describe("Barcode im Mahlzeiten-Formular", () => {
  const netz = vi.fn();
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "on");
    setzeZurueck();
    setzeQueue();
    vi.stubGlobal("fetch", netz);
    netz.mockResolvedValue(new Response(JSON.stringify(NUTELLA)));
  });
  afterEach(async () => {
    cleanup();
    await synchronisiere();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    netz.mockReset();
    delete (window as { BarcodeDetector?: unknown }).BarcodeDetector;
    delete (navigator as { mediaDevices?: unknown }).mediaDevices;
  });
  const wert = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;
  const schlageNach = (code: string) => {
    fireEvent.change(screen.getByLabelText("Barcode (freiwillig)"), { target: { value: code } });
    fireEvent.click(screen.getByRole("button", { name: "Nachschlagen" }));
  };
  const zeilen = () => fuehreAbfrage("meals", [{ m: "select", a: ["*"] }]).data as Record<string, unknown>[];

  test("ohne BarcodeDetector gibt es keinen Scan-Button, die Eingabe von Hand funktioniert", async () => {
    render(await EssenPage());
    expect(screen.queryByRole("button", { name: "Mit Kamera scannen" })).toBeNull();
    schlageNach("3017 6240 10701");
    await vi.waitFor(() => expect(wert("Was hast du gegessen?")).toBe("Nutella (Ferrero)"));
    expect(netz).toHaveBeenCalledWith("/api/barcode/3017624010701");
  });

  test("Treffer befüllt das Formular je 100 g mit Hinweis; Felder ohne Wert bleiben leer; die Portion rechnet um", async () => {
    render(await EssenPage());
    schlageNach("3017624010701");
    await vi.waitFor(() => expect(wert("Kalorien in kcal (freiwillig)")).toBe("539"));
    expect(wert("Menge (freiwillig)")).toBe("100 g");
    expect(wert("Eiweiß in g (freiwillig)")).toBe("6,3");
    expect(wert("Fett in g (freiwillig)")).toBe("");
    expect(screen.getByText(MELDUNGEN.hinweis)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Portion in Gramm"), { target: { value: "30" } });
    expect(wert("Kalorien in kcal (freiwillig)")).toBe("162");
    expect(wert("Menge (freiwillig)")).toBe("30 g");
    expect(wert("Kohlenhydrate in g (freiwillig)")).toBe("17,3");
  });

  test("Speichern setzt source = 'barcode' und den Code; eine Mahlzeit von Hand danach bleibt manuell", async () => {
    render(await EssenPage());
    schlageNach("3017624010701");
    await vi.waitFor(() => expect(wert("Kalorien in kcal (freiwillig)")).toBe("539"));
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    await vi.waitFor(() => expect(zeilen()).toHaveLength(1));
    expect(zeilen()[0]).toMatchObject({ name: "Nutella (Ferrero)", amount_note: "100 g", kcal: 539, source: "barcode", barcode: "3017624010701" });
    fireEvent.change(screen.getByLabelText("Was hast du gegessen?"), { target: { value: "Apfel" } });
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    await vi.waitFor(() => expect(zeilen()).toHaveLength(2));
    expect(zeilen().find((z) => z.name === "Apfel")).toMatchObject({ source: "manuell" });
  });

  test("unbekannter Code zeigt die ruhige Meldung, das Formular bleibt nutzbar", async () => {
    netz.mockResolvedValue(new Response("{}", { status: 404 }));
    render(await EssenPage());
    schlageNach("3017624010701");
    expect((await within(screen.getByRole("group", { name: "Barcode" })).findByRole("status")).textContent).toBe("Dazu kenne ich nichts – trag es gern selbst ein.");
    expect(wert("Was hast du gegessen?")).toBe("");
    expect((screen.getByRole("button", { name: "Hinzufügen" }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("ungültiger Code fragt den Server nicht; Dienstfehler zeigt eine Meldung", async () => {
    render(await EssenPage());
    schlageNach("123");
    expect((await screen.findByText(MELDUNGEN.ungueltig)).textContent).toBeTruthy();
    expect(netz).not.toHaveBeenCalled();
    netz.mockResolvedValue(new Response("{}", { status: 502 }));
    schlageNach("3017624010701");
    expect(await screen.findByText(MELDUNGEN.fehler)).toBeTruthy();
  });

  test("mit BarcodeDetector-Attrappe liefert der Scan den Code und beendet den Stream", async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn(async () => ({ getTracks: () => [{ stop }] }));
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
    (window as { BarcodeDetector?: unknown }).BarcodeDetector = class {
      detect = async () => [{ rawValue: "3017624010701" }];
    };
    render(await EssenPage());
    fireEvent.click(screen.getByRole("button", { name: "Mit Kamera scannen" }));
    await vi.waitFor(() => expect(wert("Was hast du gegessen?")).toBe("Nutella (Ferrero)"));
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: "environment" } });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(netz).toHaveBeenCalledWith("/api/barcode/3017624010701");
    expect(screen.queryByRole("button", { name: "Scan abbrechen" })).toBeNull();
  });

  test("Kamera verweigert: Meldung, Eingabe von Hand bleibt", async () => {
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: async () => { throw new Error("NotAllowedError"); } }, configurable: true });
    (window as { BarcodeDetector?: unknown }).BarcodeDetector = class { detect = async () => []; };
    render(await EssenPage());
    fireEvent.click(screen.getByRole("button", { name: "Mit Kamera scannen" }));
    expect(await screen.findByText(MELDUNGEN.kamera)).toBeTruthy();
  });
});
