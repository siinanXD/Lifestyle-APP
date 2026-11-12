// Barcode-Nachschlag über Open Food Facts (SIN-1294): offene Lebensmitteldatenbank, kein Schlüssel, keine Kosten.
// An den Dienst geht nur die Produktnummer, nie eine Nutzerkennung. Fehlende Werte bleiben null; es wird nie 0 erfunden.
export type Produkt = {
  name: string;
  menge: string | null; // Packungsangabe, z. B. „400 g“
  kcal100g: number | null;
  protein100g: number | null;
  carbs100g: number | null;
  fat100g: number | null;
};

export const OFF_URL = (code: string) =>
  `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=code,product_name,product_name_de,brands,quantity,nutriments`;
export const OFF_USER_AGENT = "Lifestyle-APP/0.1 (https://github.com/siinanXD/Lifestyle-APP)";
export const OFF_TIMEOUT_MS = 5000;

/** Prüfziffer nach GS1 (EAN-8, EAN-13 und die übrigen GTIN-Längen): von rechts abwechselnd ×3 und ×1. */
function pruefzifferStimmt(ziffern: string): boolean {
  const summe = [...ziffern.slice(0, -1)].reverse().reduce((s, z, i) => s + Number(z) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (summe % 10)) % 10 === Number(ziffern.at(-1));
}

/** Nur Ziffern, 8 bis 14 Stellen; Leerzeichen und Bindestriche fallen weg. Bei EAN-8 und EAN-13 muss die Prüfziffer stimmen. Sonst null. */
export function normalisiereBarcode(text: string): string | null {
  const code = text.replace(/[\s-]/g, "");
  if (!/^[0-9]{8,14}$/.test(code)) return null;
  if ((code.length === 8 || code.length === 13) && !pruefzifferStimmt(code)) return null;
  return code;
}

const zahl = (wert: unknown): number | null => {
  // Der Dienst liefert Zahlen, bei manchen Produkten aber Text ("12.5") oder gar nichts.
  if (wert === null || wert === undefined || wert === "") return null;
  const n = typeof wert === "number" ? wert : Number(wert);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null;
};
const text = (wert: unknown) => (typeof wert === "string" && wert.trim() !== "" ? wert.trim() : null);

/** Liest die Antwort des Dienstes. Kein Produkt (`status: 0`), kein Name oder unlesbare Antwort → null. */
export function parseProdukt(json: unknown): Produkt | null {
  if (!json || typeof json !== "object") return null;
  const { status, product } = json as { status?: unknown; product?: Record<string, unknown> };
  if (status !== 1 || !product || typeof product !== "object") return null;
  const name = text(product.product_name_de) ?? text(product.product_name);
  if (!name) return null;
  const marke = text(product.brands)?.split(",")[0].trim();
  const n = (product.nutriments ?? {}) as Record<string, unknown>;
  return {
    name: (marke && !name.toLowerCase().includes(marke.toLowerCase()) ? `${name} (${marke})` : name).slice(0, 100),
    menge: text(product.quantity),
    kcal100g: zahl(n["energy-kcal_100g"]) === null ? null : Math.round(zahl(n["energy-kcal_100g"])!),
    protein100g: zahl(n.proteins_100g),
    carbs100g: zahl(n.carbohydrates_100g),
    fat100g: zahl(n.fat_100g),
  };
}
