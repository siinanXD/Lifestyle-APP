import { normalisiereBarcode, type Produkt } from "./openfoodfacts";

// Barcode im Mahlzeiten-Formular (SIN-1295): nachschlagen, auf die Portion umrechnen. Ohne Bibliothek, ohne neue Abhängigkeit.
export type Naehrwerte = { kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null };
export type Treffer = Produkt & { code: string };

/** Rechnet Werte je 100 g auf eine Portion um. Fehlende Werte bleiben null; kcal ganzzahlig, Gramm auf eine Nachkommastelle. */
export function skaliere(p: Pick<Produkt, "kcal100g" | "protein100g" | "carbs100g" | "fat100g">, gramm: number): Naehrwerte {
  const anteil = (wert: number | null, stellen: number) => (wert === null ? null : Math.round(((wert * gramm) / 100) * 10 ** stellen) / 10 ** stellen);
  return { kcal: anteil(p.kcal100g, 0), protein_g: anteil(p.protein100g, 1), carbs_g: anteil(p.carbs100g, 1), fat_g: anteil(p.fat100g, 1) };
}

export const istGueltigePortion = (gramm: number) => Number.isFinite(gramm) && gramm > 0 && gramm <= 5000;

export type Suche = { ok: true; produkt: Treffer } | { ok: false; grund: "ungueltig" | "unbekannt" | "fehler" };

/** Fragt die eigene Route /api/barcode/<code>; der Aufruf des Dienstes passiert auf dem Server. */
export async function sucheProdukt(eingabe: string): Promise<Suche> {
  const code = normalisiereBarcode(eingabe);
  if (!code) return { ok: false, grund: "ungueltig" };
  try {
    const r = await fetch(`/api/barcode/${code}`);
    if (r.status === 404) return { ok: false, grund: "unbekannt" };
    if (!r.ok) return { ok: false, grund: "fehler" };
    return { ok: true, produkt: (await r.json()) as Treffer };
  } catch {
    return { ok: false, grund: "fehler" };
  }
}

export const MELDUNGEN = {
  ungueltig: "Das ist kein gültiger Barcode. Er hat 8 bis 14 Ziffern.",
  unbekannt: "Dazu kenne ich nichts – trag es gern selbst ein.",
  fehler: "Der Nachschlag klappt gerade nicht. Du kannst die Mahlzeit trotzdem von Hand eintragen.",
  kamera: "Die Kamera lässt sich nicht nutzen. Du kannst die Ziffern von Hand eingeben.",
  hinweis: "Werte je 100 g aus Open Food Facts – bitte Menge anpassen.",
} as const;

type Detektor = { detect: (quelle: unknown) => Promise<{ rawValue: string }[]> };
type DetektorKlasse = new (optionen?: { formats: string[] }) => Detektor;

/** Die Browser-Schnittstelle BarcodeDetector, falls vorhanden (z. B. Chrome auf Android); sonst undefined und kein Scan-Button. */
export const barcodeDetektor = (): DetektorKlasse | undefined =>
  typeof window !== "undefined" && navigator.mediaDevices ? (window as unknown as { BarcodeDetector?: DetektorKlasse }).BarcodeDetector : undefined;

/**
 * Sucht im Kamerabild nach einem Barcode, bis einer gefunden ist oder `laeuft()` false liefert.
 * Es wird nichts aufgezeichnet; den Stream beendet der Aufrufer sofort nach dem Treffer.
 */
export async function findeCode(Klasse: DetektorKlasse, video: unknown, laeuft: () => boolean, pauseMs = 300): Promise<string | null> {
  const detektor = new Klasse({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
  while (laeuft()) {
    const codes = await detektor.detect(video).catch(() => []);
    const code = codes.map((c) => normalisiereBarcode(c.rawValue)).find(Boolean);
    if (code) return code;
    await new Promise((weiter) => setTimeout(weiter, pauseMs));
  }
  return null;
}
