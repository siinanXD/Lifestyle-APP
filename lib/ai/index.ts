import { erzeugeFakeAnbieter } from "./fake";
import type { LlmProvider } from "./provider";

const AUS: LlmProvider = { generiere: async () => ({ ok: false, grund: "aus" }) };

/**
 * Der Anbieter laut Umgebung. Standard ist „aus“: Nur `AI_ENABLED=on` schaltet die KI ein, weil jeder echte Aufruf Geld kostet.
 * `LLM_PROVIDER=anthropic` bleibt „aus“, bis der Adapter da ist (SIN-1309); unbekannte Werte ebenso.
 */
export function holeAnbieter(erzeugeFake = erzeugeFakeAnbieter): LlmProvider {
  if (process.env.AI_ENABLED !== "on") return AUS;
  if (process.env.LLM_PROVIDER === "fake") return erzeugeFake({ modell: process.env.LLM_MODEL || undefined });
  return AUS;
}
