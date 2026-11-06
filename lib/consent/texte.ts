// Wortlaut aus docs/PRIVACY.md, Abschnitt 3. Ändert sich ein Text, muss `version` mitwandern,
// damit die gespeicherte Einwilligung zeigt, welchen Wortlaut die Person gesehen hat.
export const ARTEN = ["A", "B", "C", "D", "E"] as const;
export type Art = (typeof ARTEN)[number];

export type Einwilligungstext = { titel: string; version: string; text: string; gesundheitsdaten: boolean };

export const EINWILLIGUNGSTEXTE: Record<Art, Einwilligungstext> = {
  A: {
    titel: "Profil & Gewohnheiten",
    version: "2026-10-30",
    gesundheitsdaten: false,
    text: "Ich willige ein, dass die App meine Ziele, mein Zeitbudget, meine Erfahrung, meine Geräte und meine Gewohnheiten speichert, um mir einen Plan zu erstellen. Ich kann das jederzeit in den Einstellungen widerrufen.",
  },
  B: {
    titel: "Gesundheitsdaten",
    version: "2026-10-30",
    gesundheitsdaten: true,
    text: "Ich willige ausdrücklich ein, dass die App Angaben zu meiner Gesundheit und Fitness verarbeitet (Training, Beschwerden, Befinden, Körperwerte, Ernährung, Schlaf), soweit ich sie eingebe. Zweck: Trainingsvorschläge anpassen und meinen Fortschritt zeigen. Die Angaben sind freiwillig. Die App stellt keine Diagnosen und ersetzt keine ärztliche Beratung. Ich kann die Einwilligung jederzeit widerrufen; die bis dahin erfolgte Verarbeitung bleibt rechtmäßig.",
  },
  C: {
    titel: "Fototagebuch",
    version: "2026-10-30",
    gesundheitsdaten: true,
    text: "Ich willige ein, dass meine Fortschrittsfotos privat in meinem Konto gespeichert werden. Nur ich kann sie sehen. Ich kann sie jederzeit einzeln oder alle löschen.",
  },
  D: {
    titel: "Foto-Erkennung",
    version: "2026-10-30",
    gesundheitsdaten: true,
    // [Anbieter] bleibt Platzhalter, bis Sinan den KI-Anbieter festlegt (docs/PRIVACY.md, offene Frage 4).
    text: "Ich willige ein, dass das Foto zur Erkennung an den KI-Dienst [Anbieter] übermittelt wird. Das Originalfoto wird nach der Auswertung gelöscht. Ich kann das Ergebnis immer korrigieren oder die Daten manuell eingeben.",
  },
  E: {
    titel: "KI-Coach",
    version: "2026-10-30",
    gesundheitsdaten: true,
    text: "Ich willige ein, dass meine Fragen an den KI-Coach und die dafür nötigen Fachwerte (Ziel, Erfahrung, Einschränkung als Kategorie) an den KI-Dienst [Anbieter] übermittelt werden. Vor der Übermittlung entfernt die App Namen, E-Mail, Nutzer-ID, Adressen, Telefonnummern, Datumsangaben und andere Hinweise auf meine Person; Freitext geht nur in der bereinigten Fassung, die ich vorher sehe. Ohne diese Einwilligung läuft die App ohne KI-Coach weiter.",
  },
};
