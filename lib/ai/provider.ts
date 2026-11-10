export type LlmFehlgrund = "aus" | "zeitlimit" | "quote" | "dienstfehler" | "ungueltig";

export type LlmAnfrage = {
  system: string;
  nutzer: string;
  bild?: { base64: string; mime: string };
  maxAusgabeTokens?: number;
  zeitlimitMs?: number;
  signal?: AbortSignal;
};

export type LlmErgebnis =
  | { ok: true; text: string; tokensEin: number; tokensAus: number; modell: string }
  | { ok: false; grund: LlmFehlgrund };

export type LlmProvider = { generiere(anfrage: LlmAnfrage): Promise<LlmErgebnis> };

// Harte Obergrenzen: Jeder echte Aufruf kostet Geld, und eine hängende KI darf das Tracking nicht aufhalten.
export const MAX_AUSGABE_TOKENS = 600;
export const ZEITLIMIT_MS = 20_000;

const begrenze = (wert: number | undefined, max: number) => (wert !== undefined && wert >= 1 ? Math.min(Math.floor(wert), max) : max);

/**
 * Macht aus einem rohen Adapter einen Anbieter, der nie wirft: Limits kappen, Zeitlimit und `signal` zu einem
 * Abbruchsignal bündeln, Fehler zu `ok: false`. Abbruch durch den Aufrufer zählt wie `zeitlimit`.
 * Kein Logging: Prompts, Antworten und Fehlertexte können Gesundheitsdaten oder Schlüssel enthalten (docs/PRIVACY.md 7).
 */
export function absichern(roh: LlmProvider): LlmProvider {
  return {
    async generiere(anfrage) {
      const zeitlimitMs = begrenze(anfrage.zeitlimitMs, ZEITLIMIT_MS);
      const abbruch = new AbortController();
      const stoppe = () => abbruch.abort();
      if (anfrage.signal?.aborted) return { ok: false, grund: "zeitlimit" };
      anfrage.signal?.addEventListener("abort", stoppe, { once: true });
      const wecker = setTimeout(stoppe, zeitlimitMs);
      try {
        return await Promise.race([
          roh.generiere({ ...anfrage, maxAusgabeTokens: begrenze(anfrage.maxAusgabeTokens, MAX_AUSGABE_TOKENS), zeitlimitMs, signal: abbruch.signal }),
          new Promise<LlmErgebnis>((fertig) =>
            abbruch.signal.addEventListener("abort", () => fertig({ ok: false, grund: "zeitlimit" }), { once: true }),
          ),
        ]);
      } catch {
        return { ok: false, grund: abbruch.signal.aborted ? "zeitlimit" : "dienstfehler" };
      } finally {
        clearTimeout(wecker);
        anfrage.signal?.removeEventListener("abort", stoppe);
      }
    },
  };
}
