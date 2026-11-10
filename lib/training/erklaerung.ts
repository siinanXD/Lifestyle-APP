import type { Grund } from "./empfehlung";

// Der KI-freie Rückfall: Fällt die KI-Formulierung aus, bleiben diese Sätze. Ton: ruhig, ein Angebot, nie eine Pflicht
// und keine medizinische Aussage. `Record<Grund, …>` erzwingt einen Text für jeden Code.
export const ERKLAERUNGEN: Record<Grund, string> = {
  zu_wenig_einheiten: "Erst nach drei vergleichbaren Einheiten prüfen wir eine Steigerung – du bist auf dem Weg.",
  gewicht_wechselte:
    "In den letzten drei Einheiten hat das Gewicht gewechselt. Bleib erst einmal bei einem Gewicht, dann prüfen wir eine Steigerung.",
  ziel_nicht_erreicht:
    "Das obere Wiederholungsziel war noch nicht in allen Sätzen erreicht. Das Gewicht bleibt gleich, bis das in drei Einheiten geklappt hat.",
  technik: "Die Technik war zuletzt noch wackelig, deshalb bleibt das Gewicht gleich. Eine saubere Ausführung geht vor.",
  schmerz:
    "Du hast Schmerzen angegeben, deshalb bleibt das Gewicht gleich. Bei anhaltenden Beschwerden hol dir bitte ärztlichen Rat.",
  regeneration: "Du warst zuletzt wenig erholt, deshalb bleibt das Gewicht heute gleich.",
  ziel_erreicht:
    "Du hast das obere Wiederholungsziel in drei Einheiten sauber erreicht. Eine Stufe mehr kannst du ausprobieren – fühlt es sich nicht gut an, bleib beim bisherigen Gewicht.",
  comeback_stufe_1: "Nach deiner Pause starten wir mit etwas weniger Gewicht. Eine Steigerung prüfen wir danach wieder.",
  comeback_stufe_2:
    "Nach deiner längeren Pause starten wir mit weniger Gewicht und einem Satz weniger. Eine Steigerung prüfen wir danach wieder.",
  comeback_stufe_3:
    "Nach deiner langen Pause starten wir mit deutlich weniger Gewicht und einem Satz weniger. Eine Steigerung prüfen wir erst nach einigen Einheiten wieder.",
};

export const erklaere = (grund: Grund): string => ERKLAERUNGEN[grund];
