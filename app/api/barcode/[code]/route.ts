import { NextResponse } from "next/server";
import { normalisiereBarcode, OFF_TIMEOUT_MS, OFF_URL, OFF_USER_AGENT, parseProdukt } from "../../../../lib/essen/openfoodfacts";
import { createClient } from "../../../../lib/supabase/server";

// Barcode-Nachschlag (SIN-1294): nur für angemeldete Personen, Aufruf des Dienstes nur vom Server aus, ohne Nutzerkennung.
// Keine Logausgabe: Der Code soll nirgends zusammen mit einer Person auftauchen.
const antwort = (status: number, fehler: string, meldung: string) => NextResponse.json({ fehler, meldung }, { status });

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  // Ein einziger Schalter stellt den Dienst ab (Standard: an).
  if (process.env.BARCODE_LOOKUP === "off") return antwort(404, "abgeschaltet", "Der Barcode-Nachschlag ist abgeschaltet.");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return antwort(401, "nicht_angemeldet", "Bitte melde dich an.");
  const code = normalisiereBarcode((await params).code);
  if (!code) return antwort(400, "ungueltig", "Das ist kein gültiger Barcode.");

  let json: unknown;
  try {
    const r = await fetch(OFF_URL(code), { headers: { "User-Agent": OFF_USER_AGENT }, signal: AbortSignal.timeout(OFF_TIMEOUT_MS) });
    // Der Dienst meldet unbekannte Produkte mit 404 oder mit status 0 im JSON.
    if (r.status === 404) return antwort(404, "unbekannt", "Dazu ist nichts bekannt.");
    if (!r.ok) return antwort(502, "dienst", "Der Dienst antwortet gerade nicht.");
    json = await r.json();
  } catch {
    return antwort(502, "dienst", "Der Dienst antwortet gerade nicht.");
  }
  const produkt = parseProdukt(json);
  if (!produkt) return antwort(404, "unbekannt", "Dazu ist nichts bekannt.");
  // Produktdaten ändern sich selten: einen Tag im Browser der Person halten, nicht in geteilten Caches.
  return NextResponse.json({ code, ...produkt }, { headers: { "Cache-Control": "private, max-age=86400" } });
}
