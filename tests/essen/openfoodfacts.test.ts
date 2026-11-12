import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "../../app/api/barcode/[code]/route";
import { normalisiereBarcode, parseProdukt } from "../../lib/essen/openfoodfacts";

// Fixtur in der Form der Dienst-Antwort (api/v2/product), gekürzt auf die genutzten Felder. Kein Netzzugriff im Test.
const fixtur = JSON.parse(readFileSync("tests/essen/fixtures/off-produkt.json", "utf8"));
const sitzung = vi.hoisted(() => ({ user: { id: "u1" } as { id: string } | null }));
vi.mock("../../lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: sitzung.user } }) } }) }));

describe("normalisiereBarcode", () => {
  test("Leerzeichen und Bindestriche fallen weg", () => {
    expect(normalisiereBarcode(" 3017 6240-10701 ")).toBe("3017624010701");
    expect(normalisiereBarcode("4000-1235")).toBe(null); // EAN-8 mit falscher Prüfziffer
    expect(normalisiereBarcode("96385074")).toBe("96385074"); // EAN-8 mit richtiger Prüfziffer
  });
  test("zu kurz, zu lang, Buchstaben, leer", () => {
    for (const text of ["1234567", "123456789012345", "30176240107O1", "", "abc"]) expect(normalisiereBarcode(text), text).toBeNull();
  });
  test("EAN-13 mit falscher Prüfziffer wird abgelehnt (Tippfehler)", () => expect(normalisiereBarcode("3017624010702")).toBeNull());
  test("12 Stellen (UPC) gehen ohne Prüfung durch", () => expect(normalisiereBarcode("012345678905")).toBe("012345678905"));
});

describe("parseProdukt", () => {
  test("vollständiges Produkt", () => {
    expect(parseProdukt(fixtur)).toEqual({ name: "Nutella (Ferrero)", menge: "400 g", kcal100g: 539, protein100g: 6.3, carbs100g: 57.5, fat100g: 30.9 });
  });
  test("fehlende Nährwerte bleiben null, es wird keine 0 erfunden", () => {
    const ohne = { ...fixtur, product: { product_name: "Haferflocken", nutriments: { "energy-kcal_100g": 372, proteins_100g: "13.5" } } };
    expect(parseProdukt(ohne)).toEqual({ name: "Haferflocken", menge: null, kcal100g: 372, protein100g: 13.5, carbs100g: null, fat100g: null });
    expect(parseProdukt({ status: 1, product: { product_name: "Wasser" } })).toMatchObject({ kcal100g: null, protein100g: null });
  });
  test("ein echter Wert 0 bleibt 0", () => {
    expect(parseProdukt({ status: 1, product: { product_name: "Wasser", nutriments: { "energy-kcal_100g": 0, fat_100g: 0 } } })).toMatchObject({ kcal100g: 0, fat100g: 0 });
  });
  test("kein Produkt (status 0), kein Name oder unlesbare Antwort → null", () => {
    expect(parseProdukt({ code: "1", status: 0, status_verbose: "product not found" })).toBeNull();
    expect(parseProdukt({ status: 1, product: { nutriments: {} } })).toBeNull();
    for (const kaputt of [null, "text", 42, {}]) expect(parseProdukt(kaputt)).toBeNull();
  });
  test("negative oder unlesbare Zahlen werden zu null", () => {
    expect(parseProdukt({ status: 1, product: { product_name: "X", nutriments: { proteins_100g: -3, fat_100g: "viel" } } })).toMatchObject({ protein100g: null, fat100g: null });
  });
});

describe("Route /api/barcode/[code]", () => {
  const rufe = (code = "3017624010701") => GET(new Request(`http://localhost/api/barcode/${code}`), { params: Promise.resolve({ code }) });
  const netz = vi.fn();
  beforeEach(() => {
    sitzung.user = { id: "u1" };
    vi.stubGlobal("fetch", netz);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    netz.mockReset();
  });

  test("ohne Sitzung 401, der Dienst wird nicht gerufen", async () => {
    sitzung.user = null;
    expect((await rufe()).status).toBe(401);
    expect(netz).not.toHaveBeenCalled();
  });

  test("Treffer: Produkt mit Code, Cache einen Tag privat; an den Dienst geht nur der Code mit User-Agent", async () => {
    netz.mockResolvedValue(new Response(JSON.stringify(fixtur)));
    const r = await rufe();
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ code: "3017624010701", name: "Nutella (Ferrero)", kcal100g: 539 });
    expect(r.headers.get("Cache-Control")).toBe("private, max-age=86400");
    const [url, init] = netz.mock.calls[0];
    expect(url).toContain("/api/v2/product/3017624010701.json");
    expect(url).not.toContain("u1");
    expect(init.headers["User-Agent"]).toContain("Lifestyle-APP");
    expect(JSON.stringify(init.headers)).not.toContain("u1");
  });

  test("unbekanntes Produkt (status 0 oder 404 vom Dienst) → 404", async () => {
    netz.mockResolvedValue(new Response(JSON.stringify({ status: 0 })));
    expect((await rufe()).status).toBe(404);
    netz.mockResolvedValue(new Response("", { status: 404 }));
    expect((await rufe()).status).toBe(404);
  });

  test("Dienstfehler, Timeout oder kaputte Antwort → 502", async () => {
    netz.mockResolvedValue(new Response("", { status: 500 }));
    expect((await rufe()).status).toBe(502);
    netz.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    expect((await rufe()).status).toBe(502);
    netz.mockResolvedValue(new Response("kein json"));
    expect((await rufe()).status).toBe(502);
  });

  test("ungültiger Code → 400, ohne Aufruf des Dienstes", async () => {
    expect((await rufe("abc")).status).toBe(400);
    expect(netz).not.toHaveBeenCalled();
  });

  test("BARCODE_LOOKUP=off → 404 mit klarer Meldung, ohne Aufruf des Dienstes", async () => {
    vi.stubEnv("BARCODE_LOOKUP", "off");
    const r = await rufe();
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ fehler: "abgeschaltet", meldung: "Der Barcode-Nachschlag ist abgeschaltet." });
    expect(netz).not.toHaveBeenCalled();
  });
});
