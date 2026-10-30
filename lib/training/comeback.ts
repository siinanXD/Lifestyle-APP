export type Befinden = "gut" | "mittel" | "schlecht";

export type Comeback = {
  stufe: 0 | 1 | 2 | 3;
  gewichtFaktor: number;
  satzAbzug: number;
  progressionAusEinheiten: number;
};

// Stufe 0 = normal weiter. Werte nach Sinans Freigabe vom 29.10. (SIN-1172); Progressionspause in Stufe 2 war dort offen und ist 1,
// damit sie mit der Stufe nie sinkt (sonst wäre `schlecht` bei 14–27 Tagen weniger vorsichtig als `gut`).
const STUFEN: Omit<Comeback, "stufe">[] = [
  { gewichtFaktor: 1, satzAbzug: 0, progressionAusEinheiten: 0 },
  { gewichtFaktor: 0.9, satzAbzug: 0, progressionAusEinheiten: 1 },
  { gewichtFaktor: 0.8, satzAbzug: 1, progressionAusEinheiten: 1 },
  { gewichtFaktor: 0.6, satzAbzug: 1, progressionAusEinheiten: 4 },
];
const STUFE_AB_TAGEN = [14, 28, 84];

/**
 * Wiedereinstieg nach Pause: Code für Gewichtsfaktor, Satzabzug und Progressionspause, kein Text.
 * `schlecht` stuft eine Stufe weiter runter; fehlende Angabe und `mittel` zählen wie `gut`.
 */
export function bewerteComeback(tageSeitLetzterEinheit: number, befinden?: Befinden): Comeback {
  if (!Number.isFinite(tageSeitLetzterEinheit) || tageSeitLetzterEinheit < 0) {
    throw new Error("Tage seit der letzten Einheit müssen eine Zahl ab 0 sein");
  }
  const nachTagen = STUFE_AB_TAGEN.filter((ab) => tageSeitLetzterEinheit >= ab).length;
  const stufe = Math.min(nachTagen + (befinden === "schlecht" ? 1 : 0), 3) as Comeback["stufe"];
  return { stufe, ...STUFEN[stufe] };
}
