export type Einheit = {
  gewichtKg: number;
  wiederholungenProSatz: number[];
  technik: "sauber" | "wackelig";
  schmerz: boolean;
  regeneration: "gut" | "schlecht" | "unbekannt";
};

export type Ziel = { wdhMin: number; wdhMax: number };

export type Progression =
  | { aktion: "steigerung_pruefen"; vorschlagKg: number }
  | {
      aktion: "halten";
      grund:
        | "zu_wenig_einheiten"
        | "gewicht_wechselte"
        | "ziel_nicht_erreicht"
        | "technik"
        | "schmerz"
        | "regeneration";
    };

const EINHEITEN_FUER_BEWERTUNG = 3;

const halten = (grund: Extract<Progression, { aktion: "halten" }>["grund"]): Progression => ({
  aktion: "halten",
  grund,
});

/**
 * Konservative Progression: Nur die drei jüngsten Einheiten zählen (`einheiten` ist älteste → neueste).
 * Gibt einen Vorschlag mit Code zurück, nie eine Pflicht und keinen Text. Reihenfolge der Prüfung:
 * zu wenig Einheiten, Schmerz (Vorrang), Gewichtswechsel, Technik, Regeneration, Wiederholungsziel.
 */
export function bewerteProgression(einheiten: Einheit[], ziel: Ziel, kleinsteStufeKg: number): Progression {
  if (!(kleinsteStufeKg > 0)) throw new Error("kleinsteStufeKg muss größer als 0 sein");
  if (ziel.wdhMin > ziel.wdhMax) throw new Error("wdhMin darf nicht größer als wdhMax sein");
  if (einheiten.some((e) => e.wiederholungenProSatz.some((wdh) => wdh < 0))) {
    throw new Error("Wiederholungen dürfen nicht negativ sein");
  }

  if (einheiten.length < EINHEITEN_FUER_BEWERTUNG) return halten("zu_wenig_einheiten");
  const letzte = einheiten.slice(-EINHEITEN_FUER_BEWERTUNG);
  const juengste = letzte[letzte.length - 1];

  if (letzte.some((e) => e.schmerz)) return halten("schmerz");
  if (letzte.some((e) => e.gewichtKg !== juengste.gewichtKg)) return halten("gewicht_wechselte");
  if (letzte.some((e) => e.technik === "wackelig")) return halten("technik");
  if (juengste.regeneration === "schlecht") return halten("regeneration");
  const zielErreicht = letzte.every(
    (e) => e.wiederholungenProSatz.length > 0 && e.wiederholungenProSatz.every((wdh) => wdh >= ziel.wdhMax),
  );
  if (!zielErreicht) return halten("ziel_nicht_erreicht");

  return { aktion: "steigerung_pruefen", vorschlagKg: juengste.gewichtKg + kleinsteStufeKg };
}
