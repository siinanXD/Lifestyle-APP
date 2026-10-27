# Onboarding-Ablauf (Text-Wireframe, Entwurf)

Status: **Entwurf (SIN-1134), Sinan liest und gibt frei.** Unabhängig von der Figma-Datei (SIN-1086); nach Fertigstellung des Designs wird abgeglichen. Einwilligungen A bis E und ihre Texte stehen im Datenschutzentwurf `docs/PRIVACY.md` (SIN-1133, PR #8), Abschnitt 3. Dieses Dokument wiederholt sie nicht, sondern verweist auf die Buchstaben.

## Grundregeln

1. **Alles ist freiwillig.** Es gibt keinen Pflichtschritt. Das Konto (E-Mail, Passwort) entsteht vorher und gehört nicht zum Onboarding.
2. **Überspringen ist immer gleichwertig:** Auf jedem Bildschirm stehen „Weiter“ und „Überspringen“ gleich groß, dazu „Alles überspringen“. Kein Warnhinweis, keine Rückfrage.
3. **Ton:** Du-Form, ruhig, ohne Druck. Keine Wörter wie „musst“, „solltest“, „schaffst“. Keine Wunschgewichte, keine Vergleiche mit anderen, kein Prozentbalken (nur Punkte), keine Streaks oder Erinnerungsdrohungen.
4. **Sparsam fragen:** Pro Bildschirm eine Frage, nur Felder, die eine Funktion braucht. Einwilligungen kommen genau dann, wenn die erste Angabe dazu ansteht, einzeln und nicht vorangekreuzt.
5. **Zurück** ist immer möglich. Alle Angaben lassen sich später in den Einstellungen ändern oder löschen.

## Ablauf

```
 Willkommen → 1 Ziele → 2 Zeit → 3 Erfahrung → 4 Einschränkungen
            → 5 Geräte → 6 Freiwillige Daten → Zusammenfassung → Start
```

### Schritt 0: Willkommen und Einwilligung A

```
 Hi! Erzähl mir kurz, was du vorhast. Alles ist freiwillig.
 [ ] Ich willige ein, dass die App meine Angaben zu Zielen, Zeit,
     Erfahrung, Geräten und Gewohnheiten speichert. (Text A)
 [ Los geht's ]   [ Überspringen ]   [ Alles überspringen ]
```

- Ohne Haken oder bei „Überspringen“ speichert die App keine Profilangaben; die Schritte 1, 2, 3, 5 und die Gewohnheiten in 6 entfallen. Schritt 4 und die Körperwerte in 6 brauchen eigene Einwilligung B und entfallen ebenso, KI-Coach (E) bleibt aus.
- Mit Haken: Zeitstempel und Textversion werden gespeichert (PRIVACY Abschnitt 3).

### Schritte im Überblick

| # | Frage (Wortlaut) | Antwortart | Pflicht? | Verwendung der Antwort | Art. 9 / Einwilligung |
|---|---|---|---|---|---|
| 1 | „Was möchtest du erreichen? Beschreib es so, wie du es sagen würdest.“ | Auswahl-Chips (bis 3), z. B. „Mehr Ausdauer“, „Breitere Schultern“, „Kräftiger werden“, „Beweglicher werden“, „Einfach aktiver sein“, „Weiß ich noch nicht“; optional Freitext | freiwillig | Zielgewichtung im Plan; Chips werden als Fachwerte in Prompts genutzt, Freitext nie ungeprüft | nein, Grenzfall / A |
| 2 | „Wie viel Zeit passt in deinen Alltag?“ | Tage pro Woche (1 bis 6, „Mal so, mal so“) und Minuten pro Einheit (15, 30, 45, 60+) | freiwillig | Anzahl und Länge der Einheiten im Plan | nein / A |
| 3 | „Wo stehst du gerade?“ | Einzelauswahl: „Ich fange an“, „Ich war länger raus“, „Ich trainiere regelmäßig“ | freiwillig | Startumfang und Übungsauswahl; „länger raus“ aktiviert einen sanften Einstieg (Smart Comeback) | nein / A |
| 4 | „Gibt es etwas, worauf wir Rücksicht nehmen sollen?“ | Mehrfachauswahl Körperbereich (Knie, Rücken, Schulter, Handgelenk, Sonstiges), „Nein / möchte ich nicht sagen“; optional Kurztext | freiwillig | Übungen auslassen oder anpassen, Belastung begrenzen | **ja / B** |
| 5 | „Was hast du zum Trainieren?“ | Mehrfachauswahl: „Nichts, nur ich“, Kurzhanteln, Langhantel, Kabelzug, Bänder, Kardiogerät, „Fitnessstudio“ | freiwillig | Filter für Übungen und Plan; Erkennung per Foto kommt später im Bereich Geräte | nein / A |
| 6 | „Magst du noch etwas teilen? Alles hier ist optional.“ | Drei getrennte Schalter, alle aus: Körperwerte (Gewicht, Größe), Gewohnheiten (z. B. Wasser, Schlaf), KI-Coach | freiwillig | Fortschrittsanzeige; Routinen; Erklärungen durch den Coach | Körperwerte **ja / B**; Gewohnheiten nein / A; KI-Coach ja bei Gesundheitsbezug / E |

Fototagebuch (C) und Foto-Erkennung (D) gehören nicht ins Onboarding; ihre Einwilligung kommt, wenn die Funktion zum ersten Mal geöffnet wird.

### Schritt 4 im Detail (freiwillige Gesundheitsangabe)

```
 Gibt es etwas, worauf wir Rücksicht nehmen sollen?
 ( ) Knie  ( ) Rücken  ( ) Schulter  ( ) Handgelenk  ( ) Sonstiges
 ( ) Nein / möchte ich nicht sagen
 Kurztext (optional): [____________]
   Hinweis: Bitte keine Diagnosen oder Medikamente eintragen.
 Das ist eine freiwillige Gesundheitsangabe.
 [ ] Ich willige ausdrücklich ein … (Text B)
 Bei Schmerzen frag bitte ärztlichen Rat; die App stellt keine Diagnosen.
 [ Weiter ]   [ Überspringen ]
```

- Ohne Einwilligung B ist „Weiter“ nur ohne Angaben möglich; der Plan enthält dann keine Anpassung an Beschwerden und sagt das offen („Allgemeiner Plan, ohne Rücksicht auf Beschwerden“).
- Das Feld zeigt keine Vorschläge aus früheren Eingaben.

### Schritt 6 im Detail (Gesundheitsangaben und Coach)

- Jeder Schalter zeigt seinen Zweck in einem Satz und den passenden Einwilligungstext (B, A, E). Aus bleibt der Standard.
- Körperwerte: Felder Gewicht und Größe, beide einzeln überspringbar. Kein Zielgewicht, kein BMI, keine Bewertung.
- KI-Coach aus heißt: App läuft vollständig ohne Coach weiter (PRIVACY Abschnitt 4).

### Zusammenfassung

```
 Das haben wir notiert:  Ziel: Mehr Ausdauer · 3 Tage · 30 Min · Fange an
                         Geräte: Nichts, nur ich · Rücksicht: nicht angegeben
 [ Ändern ]   [ Plan erstellen ]   [ Ohne Plan starten ]
```

- Zeigt nur tatsächlich gespeicherte Angaben; Übersprungenes steht als „nicht angegeben“.
- „Plan erstellen“ nutzt die Angaben. „Ohne Plan starten“ führt direkt zur Startseite.

## Zustand „Überspringen“ (Gesamtes Onboarding)

Wer „Alles überspringen“ wählt, landet sofort auf der Startseite:

1. Gespeichert wird nichts außer dem Konto; keine Einwilligung wird erteilt oder vermerkt.
2. Die App ist vollständig benutzbar: Übungsbibliothek, freies Training mit manuellem Protokoll, Wasser, Schlaf und Gewohnheiten nach jeweils eigener Einwilligung beim ersten Öffnen.
3. Ein Planvorschlag ohne Angaben ist ein allgemeiner Einsteigerplan (Vorschlag: Bodyweight, 2 bis 3 Einheiten pro Woche, ca. 30 Minuten), deutlich als „allgemeiner Vorschlag“ gekennzeichnet.
4. Auf der Startseite erscheint einmal eine ruhige Karte „Magst du dein Profil später ergänzen?“, schließbar und danach nur noch in den Einstellungen unter „Profil und Ziele“. Keine Erinnerungs-Benachrichtigung.
5. Teilweises Überspringen funktioniert genauso: Nicht beantwortete Schritte bleiben leer und können einzeln nachgeholt werden.

## Offene Punkte für Sinan

1. **Altersprüfung:** PRIVACY Frage 7 (Volljährige, Bestätigung ohne Geburtsdatum) ist ungeklärt; ein Schritt „Ich bin volljährig“ gehört dann vor Schritt 0 und wäre der einzige Pflichthaken.
2. **Standardplan ohne Angaben:** Sind die Werte in „Zustand Überspringen“ Punkt 3 richtig?
3. **Einwilligung A auf eigenem Bildschirm** (wie oben) oder eingebettet in Schritt 1?
4. **Chips und Texte** sind Vorschläge; endgültige Auswahl nach Figma-Abgleich (SIN-1086).
5. Dieses Dokument hängt von `docs/PRIVACY.md` ab, das noch nicht freigegeben ist; Änderungen dort ziehen Änderungen hier nach.
