// Wortlaut aus docs/ONBOARDING.md (Entwurf, SIN-1134). Du-Form, ohne Druck-Wörter; Chips sind Vorschläge bis zum Figma-Abgleich.
export const FRAGEN = {
  willkommen: "Hi! Erzähl mir kurz, was du vorhast. Alles ist freiwillig.",
  ziele: "Was möchtest du erreichen? Beschreib es so, wie du es sagen würdest.",
  zeit: "Wie viel Zeit passt in deinen Alltag?",
  erfahrung: "Wo stehst du gerade?",
  einschraenkungen: "Gibt es etwas, worauf wir Rücksicht nehmen sollen?",
  geraete: "Was hast du zum Trainieren?",
  freiwillig: "Magst du noch etwas teilen? Alles hier ist optional.",
  zusammenfassung: "Das haben wir notiert:",
} as const;

export const ZIELE = {
  mehr_ausdauer: "Mehr Ausdauer",
  breitere_schultern: "Breitere Schultern",
  kraeftiger: "Kräftiger werden",
  beweglicher: "Beweglicher werden",
  aktiver: "Einfach aktiver sein",
  weiss_nicht: "Weiß ich noch nicht",
} as const;

export const TAGE = [1, 2, 3, 4, 5, 6] as const;
export const MINUTEN = [15, 30, 45, 60] as const;

export const ERFAHRUNG = {
  anfaenger: "Ich fange an",
  wiedereinstieg: "Ich war länger raus",
  regelmaessig: "Ich trainiere regelmäßig",
} as const;

// Schlüssel wie der Check in lifestyle.health_profile (SIN-1258).
export const EINSCHRAENKUNGEN = {
  knie: "Knie",
  ruecken: "Rücken",
  schulter: "Schulter",
  handgelenk: "Handgelenk",
  sonstiges: "Sonstiges",
} as const;

// Schlüssel wie profiles.equipment laut SIN-1264.
export const GERAETE = {
  keine: "Nichts, nur ich",
  kurzhanteln: "Kurzhanteln",
  langhantel: "Langhantel",
  kabelzug: "Kabelzug",
  baender: "Bänder",
  kardio: "Kardiogerät",
  studio: "Fitnessstudio",
} as const;

export const HINWEIS_FREITEXT = "Bitte keine Diagnosen oder Medikamente eintragen.";
export const NICHT_ANGEGEBEN = "nicht angegeben";
