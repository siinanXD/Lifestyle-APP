import type { Comeback } from "./comeback";
import { bewerteProgression, type Einheit, type Progression, type Ziel } from "./progression";

type Haltegrund = Extract<Progression, { aktion: "halten" }>["grund"];
type Stufe = Exclude<Comeback["stufe"], 0>;

/** Alle Codes, zu denen es eine Erklärung gibt (`erklaerung.ts`). */
export type Grund = Haltegrund | "ziel_erreicht" | `comeback_stufe_${Stufe}`;

export type Empfehlung = {
  aktion: "halten" | "steigerung_pruefen" | "sanfter_einstieg";
  /** null, solange es keine Einheit gibt, von der ein Gewicht ausgehen könnte. */
  zielgewichtKg: number | null;
  saetze: number | null;
  satzAbzug: number;
  grund: Grund;
};

/**
 * Verbindet Progression und Comeback zu einem Vorschlag mit Code, kein Text (`einheiten` ist älteste → neueste).
 * Läuft ein Comeback (`progressionAusEinheiten > 0`), zählt nur der sanfte Einstieg; das Ergebnis der Progression wird verworfen.
 */
export function empfehle({
  einheiten,
  ziel,
  kleinsteStufeKg,
  comeback,
}: {
  einheiten: Einheit[];
  ziel: Ziel;
  kleinsteStufeKg: number;
  comeback?: Comeback;
}): Empfehlung {
  // Läuft auch im Comeback, weil sie die Eingaben prüft.
  const progression = bewerteProgression(einheiten, ziel, kleinsteStufeKg);
  const letzte = einheiten.at(-1);
  const saetze = letzte ? letzte.wiederholungenProSatz.length : null;

  if (comeback && comeback.progressionAusEinheiten > 0) {
    return {
      aktion: "sanfter_einstieg",
      // Abrunden: lieber eine Stufe leichter als über dem Faktorgewicht.
      zielgewichtKg: letzte ? Math.floor((letzte.gewichtKg * comeback.gewichtFaktor) / kleinsteStufeKg) * kleinsteStufeKg : null,
      saetze: saetze === null ? null : Math.max(saetze - comeback.satzAbzug, 1),
      satzAbzug: comeback.satzAbzug,
      grund: `comeback_stufe_${comeback.stufe as Stufe}`,
    };
  }
  if (progression.aktion === "steigerung_pruefen") {
    return { aktion: "steigerung_pruefen", zielgewichtKg: progression.vorschlagKg, saetze, satzAbzug: 0, grund: "ziel_erreicht" };
  }
  return { aktion: "halten", zielgewichtKg: letzte?.gewichtKg ?? null, saetze, satzAbzug: 0, grund: progression.grund };
}
