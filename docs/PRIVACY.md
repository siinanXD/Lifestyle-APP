# Datenschutzkonzept (Entwurf)

Status: **Entwurf als Arbeitsgrundlage (SIN-1133), keine Rechtsberatung.** Sinan prüft und entscheidet, ob eine juristische Prüfung nötig ist. Offene Fragen stehen am Ende. Alle Fristen und Texte sind Vorschläge.

Geltungsbereich: Lifestyle App in der geschlossenen Beta (10 Testpersonen) und die spätere Cloud-Variante. Self-Hosting: Betreiber ist dann selbst Verantwortlicher; dieses Konzept dient als Vorlage.

## 1. Grundsätze

1. **Datenminimierung:** Nur erheben, was eine konkrete Funktion braucht. Alles Optionale ist freiwillig und hat einen „Überspringen“-Weg.
2. **Gesundheitsdaten (Art. 9 DSGVO) nur mit ausdrücklicher Einwilligung** je Kategorie, getrennt von AGB und Datenschutzhinweis, jederzeit widerrufbar.
3. **Keine medizinischen Diagnosen**, keine Körperfett-Messversprechen, keine Therapieempfehlungen. Bei Schmerzen oder Beschwerden verweist die App auf ärztlichen Rat.
4. **Privat per Standard:** Keine Weitergabe, keine Social-Funktionen, keine Werbung, kein Tracking durch Dritte.
5. **Nutzerhoheit:** Export und Löschung sind jederzeit in der App möglich (Abschnitte 5 und 6).

## 2. Datenkategorien

„Art. 9?“ bedeutet: Gesundheitsdaten oder ableitbar auf die Gesundheit. Im Zweifel wird eine Kategorie wie Gesundheitsdaten behandelt.

| Kategorie | Beispiele | Art. 9? | Zweck | Einwilligung | Aufbewahrung |
|---|---|---|---|---|---|
| Konto | E-Mail, Passwort-Hash, Sprache | nein | Anmeldung, Sicherheit | nein, Vertragserfüllung (Art. 6 Abs. 1 b) | bis Kontolöschung |
| Profil & Ziele | Zielbeschreibung („breitere Schultern“), Zeitbudget, Erfahrung, Geräte | nein, Grenzfall (Ziele können Gesundheitsbezug haben) | Plan erstellen | ja, im Onboarding (Einwilligung A) | bis Löschung durch Nutzer, sonst bis Kontolöschung |
| Einschränkungen & Beschwerden | Verletzungen, Schmerzen, Vorerkrankungen als Freitext oder Auswahl | **ja** | Übungen anpassen, Belastung begrenzen | **ja, ausdrücklich (Einwilligung B)** | bis Widerruf oder Kontolöschung |
| Training | Übungen, Sätze, Wiederholungen, Gewichte, Dauer, Cardio | **ja** (Fitness- und Belastungsdaten) | Protokoll, Progression | **ja (Einwilligung B)** | bis Kontolöschung |
| Befinden & Comeback | Grund für Pause, Tagesform, Regeneration | **ja** | Wiedereinstieg anpassen | **ja (Einwilligung B)**, Angabe immer freiwillig | 12 Monate, dann automatisch löschen; vorher manuell möglich |
| Körperwerte (optional) | Gewicht, Größe, Maße | **ja** | Fortschritt | **ja (Einwilligung B)**, nur auf Wunsch | bis Löschung durch Nutzer oder Kontolöschung |
| Ernährung & Wasser | Mahlzeiten, Kalorien, Wasser, Barcode-Treffer | **ja** | Tracking, Auswertung | **ja (Einwilligung B)** | bis Kontolöschung |
| Schlaf | Dauer, Qualität (Selbstangabe) | **ja** | Regeneration, Auswertung | **ja (Einwilligung B)** | bis Kontolöschung |
| Gewohnheiten | Gewohnheitsliste, Abhaken | nein, Grenzfall | Routinen | ja, im Onboarding (Einwilligung A) | bis Kontolöschung |
| Fototagebuch | Fortschrittsfotos | **ja** (Körper, ggf. biometrisch bei Gesichtserkennung; wird nicht gemacht) | privates Tagebuch | **ja, eigene Einwilligung (Einwilligung C)** | bis Löschung durch Nutzer oder Kontolöschung |
| Geräte- und Essensfotos | Foto zur Erkennung | je nach Inhalt ja | Erkennung, danach bestätigen/korrigieren | **ja, vor jeder ersten Nutzung (Einwilligung D)** | Originalfoto nach Auswertung löschen, spätestens nach 24 Stunden; nur das bestätigte Ergebnis bleibt |
| KI-Coach-Verlauf | Fragen, Antworten | **ja**, sobald Inhalte Gesundheitsbezug haben | Erklärungen, Hilfe | **ja (Einwilligung E)**, App funktioniert auch ohne | 90 Tage, dann automatisch löschen |
| Betriebsdaten | Zeitpunkt, Fehlercode, pseudonyme Nutzer-ID | nein | Fehlersuche, Sicherheit | nein, berechtigtes Interesse (Art. 6 Abs. 1 f) | Logs 14 Tage |
| Zahlung | Stripe-Kundenreferenz | nein | spätere Abos | nein, Vertragserfüllung | Beta: keine Zahlungsdaten, Stripe nur Testmodus |

**Bewusst nicht erhoben:** Name und Anschrift, Geburtsdatum (stattdessen Altersband oder „volljährig: ja/nein“), Standort, Kontakte, Gerätekennungen für Werbung, Gesundheits-Importe aus Fremdsystemen, Diagnosen, Medikamente, Blutwerte, Zyklusdaten, Gesichtserkennung, Social-Login. Freitexte in Feldern für Beschwerden zeigen einen Hinweis: „Bitte keine Diagnosen oder Medikamente eintragen.“

## 3. Einwilligungstexte (Entwurf)

Technische Regeln: jede Einwilligung einzeln, nicht vorangekreuzt, mit Zeitstempel und Textversion gespeichert, ohne Pflicht für Funktionen, die sie nicht brauchen. Widerruf in den Einstellungen so einfach wie Erteilen. Bei Widerruf werden die betroffenen Daten nach Rückfrage gelöscht und die Funktion ausgeblendet.

- **A: Profil & Gewohnheiten.** „Ich willige ein, dass die App meine Ziele, mein Zeitbudget, meine Erfahrung, meine Geräte und meine Gewohnheiten speichert, um mir einen Plan zu erstellen. Ich kann das jederzeit in den Einstellungen widerrufen.“
- **B: Gesundheitsdaten.** „Ich willige ausdrücklich ein, dass die App Angaben zu meiner Gesundheit und Fitness verarbeitet (Training, Beschwerden, Befinden, Körperwerte, Ernährung, Schlaf), soweit ich sie eingebe. Zweck: Trainingsvorschläge anpassen und meinen Fortschritt zeigen. Die Angaben sind freiwillig. Die App stellt keine Diagnosen und ersetzt keine ärztliche Beratung. Ich kann die Einwilligung jederzeit widerrufen; die bis dahin erfolgte Verarbeitung bleibt rechtmäßig.“
- **C: Fototagebuch.** „Ich willige ein, dass meine Fortschrittsfotos privat in meinem Konto gespeichert werden. Nur ich kann sie sehen. Ich kann sie jederzeit einzeln oder alle löschen.“
- **D: Foto-Erkennung.** „Ich willige ein, dass das Foto zur Erkennung an den KI-Dienst [Anbieter] übermittelt wird. Das Originalfoto wird nach der Auswertung gelöscht. Ich kann das Ergebnis immer korrigieren oder die Daten manuell eingeben.“
- **E: KI-Coach.** „Ich willige ein, dass meine Fragen an den KI-Coach und die dafür nötigen Fachwerte (Ziel, Erfahrung, Einschränkung als Kategorie) an den KI-Dienst [Anbieter] übermittelt werden. Vor der Übermittlung entfernt die App Namen, E-Mail, Nutzer-ID, Adressen, Telefonnummern, Datumsangaben und andere Hinweise auf meine Person; Freitext geht nur in der bereinigten Fassung, die ich vorher sehe. Ohne diese Einwilligung läuft die App ohne KI-Coach weiter.“

## 4. Datenminimierung und KI

- **Keine Personendaten in Prompts:** Kein Name, keine E-Mail, keine Nutzer-ID im Klartext, keine Fotos mit erkennbarem Gesicht, keine Freitexte ungeprüft. Prompts enthalten nur die für die Frage nötigen Fachwerte (z. B. „Ziel: Ausdauer, Erfahrung: Anfänger, Einschränkung: Knie“). Der Prompt-Aufbau läuft über eine zentrale Funktion, die Felder per Allowlist übernimmt.
- **Anonymisierungsgrenze vor jeder Übermittlung (Regel 6, Codex-Fund SIN-1133):** Für Text (KI-Coach, Einwilligung E) gibt es genau einen Weg nach außen, die zentrale Prompt-Funktion. Sie nimmt Fachwerte nur per Allowlist (Ziel, Erfahrung, Zeitbudget, Geräte, Einschränkung als Kategorie wie „Knie“, Tagesform als Stufe) und nie Verlauf, Beschwerden-Historie, Körperwerte mit Datum, Fotos oder Nutzer-ID. Die Foto-Erkennung (Einwilligung D) ist der zweite, getrennte Weg: nur Geräte- und Essensfotos, kein Text aus dem Coach, keine Nutzer-ID im Aufruf; Fotos mit erkennbaren Personen werden vor dem Senden abgewiesen (Gesichtserkennung lokal, nur als Sperre), das Original wird nach der Auswertung gelöscht (Abschnitt 2, spätestens 24 h). Fortschrittsfotos (Einwilligung C) verlassen das Konto nie. Freitext des Nutzers durchläuft einen Entferner für Namen, E-Mail-Adressen, Telefonnummern, Adressen, Orte, Datumsangaben und Krankheits- oder Medikamentennamen; der Nutzer sieht die bereinigte Fassung und bestätigt sie, bevor sie gesendet wird. Bleibt nach dem Entfernen ein Hinweis auf eine Person erkennbar, wird die Nachricht nicht gesendet, sondern mit Hinweis zurückgegeben. **Prüfbar:** Ein Test schickt Beispielnachrichten mit Name, E-Mail, Adresse, Geburtsdatum und Diagnose durch die Prompt-Funktion und prüft, dass nichts davon im Prompt steht.
- Die regelbasierte Trainings-Engine entscheidet über Belastung; KI erklärt nur. KI-Ausfall oder fehlende Einwilligung E blockiert kein Tracking.
- Anbieter nur mit Auftragsverarbeitungsvertrag und ohne Training mit Nutzerdaten (offene Frage 4).
- Antworten der KI sind als solche gekennzeichnet und vom Nutzer korrigierbar.

## 5. Export

- Funktion „Meine Daten exportieren“ in den Einstellungen, ohne Support-Anfrage.
- Format: ZIP mit JSON (maschinenlesbar) und CSV für Training, Ernährung, Schlaf; Fotos als Originaldateien.
- Enthält alle Kategorien aus Abschnitt 2, die zum Konto gehören, inklusive Einwilligungsprotokoll.
- Bereitstellung innerhalb von 24 Stunden, Download-Link nur für das eigene Konto, nach 7 Tagen ungültig; die Exportdatei wird dann gelöscht.
- **Prüfbar:** Ein Test legt in jeder Kategorie einen Datensatz an und prüft, dass der Export ihn enthält und keinen fremden Datensatz.

## 6. Löschung

- Funktion „Konto löschen“ in den Einstellungen mit Bestätigung; zusätzlich Löschen einzelner Einträge, einzelner Kategorien und einzelner Fotos.
- Kontolöschung entfernt alle Datenbankzeilen, Objektspeicher-Dateien (Fotos, Exporte) und KI-Verläufe sofort aus dem Livesystem.
- Aus Backups verschwinden die Daten spätestens nach der Backup-Aufbewahrung (Vorschlag: 30 Tage); nach einem Restore wird die Löschliste erneut angewendet.
- Löschung an Dienstleister (KI-Anbieter, falls Daten gespeichert würden) wird in der Dienstleisterliste dokumentiert.
- Inaktive Konten: Erinnerung nach 12 Monaten, Löschung nach weiteren 30 Tagen ohne Reaktion (Vorschlag).
- Beta-Ende: Testpersonen erhalten Export und wahlweise Löschung innerhalb von 30 Tagen nach Beta-Ende; danach werden alle Beta-Daten gelöscht, sofern nicht ausdrücklich weitergenutzt.
- **Prüfbar:** Ein Test löscht ein Konto und prüft, dass in allen Tabellen des Schemas `lifestyle` und im Objektspeicher kein Datensatz mit dieser Nutzer-ID übrig ist.

## 7. Logging-Regeln

1. **Nie in Logs:** Inhalte aus Abschnitt 2 (Ziele, Training, Ernährung, Schlaf, Beschwerden, Befinden, Körperwerte), Fototexte und -dateinamen, KI-Prompts und -Antworten, E-Mail-Adressen, Passwörter, Tokens, Einwilligungstexte, Request- und Response-Bodies.
2. **Erlaubt:** Zeitstempel, Route, HTTP-Status, Dauer, Fehlercode, pseudonyme Nutzer-ID (nicht die E-Mail), Request-ID.
3. Fehlerberichte und Tracing (z. B. Sentry) erst nach Freigabe; dann mit abgeschalteten Bodies, Cookies, Headern mit Tokens und Nutzerkontext außer pseudonymer ID.
4. Debug-Logging ist in Produktion aus. Datenbank-Query-Logs mit Parametern sind aus.
5. Aufbewahrung: 14 Tage, danach automatisch gelöscht. Zugriff nur für Sinan.
6. **Prüfbar:** (a) CI-Test mit Beispielnutzer, der alle Funktionen durchläuft und danach die Logausgabe auf Testmarker („CANARY-GESUNDHEIT“ in allen Freitexten) durchsucht; (b) Code-Review-Regel: kein Logging von Modellobjekten ganzer Datensätze.

## 8. Technische und organisatorische Maßnahmen (Kurzfassung)

- Gemeinsames Supabase-Projekt, nur Schema `lifestyle`, RLS mit Zugriff nur auf eigene Zeilen, eigene minimale Datenbankrolle (siehe `docs/INFRASTRUCTURE.md`).
- Verschlüsselung bei der Übertragung (TLS) und im Ruhezustand; Fotos in privatem Bucket, Zugriff nur über kurzlebige signierte Links.
- Keine privilegierten Schlüssel in der PWA; Secrets nur serverseitig.
- Offline-Cache der PWA enthält nur Trainingsprotokoll des angemeldeten Nutzers und wird beim Abmelden geleert.
- Backups geprüft wiederherstellbar; Backup-Zugriff nur Sinan.
- Verzeichnis der Verarbeitungstätigkeiten und Dienstleisterliste werden aus diesem Dokument abgeleitet (Folge-Issue).

## 9. Offene rechtliche Fragen

Zur Klärung durch Sinan, ggf. mit juristischer Prüfung:

1. **Verantwortlicher und Rolle:** Wer ist Verantwortlicher in der Beta (Privatperson, Einzelunternehmen)? Ab wann gilt das als wirtschaftliche Tätigkeit?
2. **DSFA (Art. 35):** Ist eine Datenschutz-Folgenabschätzung für die Verarbeitung von Gesundheitsdaten im Beta-Umfang nötig?
3. **Datenschutzbeauftragter:** Pflicht ab Personenzahl oder Art der Verarbeitung?
4. **KI-Anbieter:** Welcher Anbieter, Auftragsverarbeitungsvertrag, Drittlandübermittlung, kein Training mit Nutzerdaten? Reichen Abo-Zugänge dafür aus, oder braucht es einen API-Vertrag (AGENTS.md Regel 4: bisher keine Modell-API)?
5. **Supabase als Auftragsverarbeiter:** Region des Projekts, Auftragsverarbeitungsvertrag, geteiltes Projekt mit anderen Apps: reicht die Schema-Trennung als Mandantentrennung?
6. **Einwilligung in der Beta:** Reicht die elektronische Einwilligung mit Zeitstempel als Nachweis? Muss der Einwilligungstext je Änderung neu eingeholt werden?
7. **Minderjährige:** Ist die Nutzung auf Volljährige zu beschränken, und wie wird das ohne Geburtsdatum geprüft?
8. **Fristen:** Sind die vorgeschlagenen Aufbewahrungsfristen (14 Tage Logs, 90 Tage KI-Verlauf, 12 Monate Befinden, 30 Tage Backup) angemessen?
9. **Fotos:** Gelten Fortschrittsfotos als besondere Kategorie, auch wenn keine biometrische Erkennung erfolgt? Reicht Einwilligung C?
10. **Hinweispflichten:** Wortlaut von Datenschutzerklärung, Impressum und Hinweis „kein Medizinprodukt“.
11. **Stripe (später):** Rollen, Auftragsverarbeitung, Aufbewahrungspflichten für Rechnungen gegen Löschpflicht.
12. **Self-Hosting:** Pflichten, die an Betreiber weitergegeben werden, und Vorlage dafür.
