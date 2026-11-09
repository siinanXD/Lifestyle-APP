import { absichern, type LlmFehlgrund, type LlmProvider } from "./provider";

export type FakeOptionen = {
  text?: string;
  /** Grund: wird als `ok: false` gemeldet. Error: wird geworfen (wie ein Netzfehler im echten Adapter). */
  fehler?: Exclude<LlmFehlgrund, "aus"> | Error;
  verzoegerungMs?: number;
  modell?: string;
};

/** Deterministischer Anbieter für Tests und lokale Entwicklung: kein Netz, kein Schlüssel, keine Kosten. */
export function erzeugeFakeAnbieter({ text = "Fake-Antwort", fehler, verzoegerungMs = 0, modell = "fake" }: FakeOptionen = {}): LlmProvider {
  return absichern({
    async generiere({ system, nutzer }) {
      if (verzoegerungMs > 0) await new Promise((weiter) => setTimeout(weiter, verzoegerungMs));
      if (fehler instanceof Error) throw fehler;
      if (fehler) return { ok: false, grund: fehler };
      return { ok: true, text, tokensEin: Math.ceil((system.length + nutzer.length) / 4), tokensAus: Math.ceil(text.length / 4), modell };
    },
  });
}
