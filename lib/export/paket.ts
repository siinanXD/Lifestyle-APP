import { alsCsv, type CsvZeile } from "./csv";
import type { ZipDatei } from "./zip";

/** Ergebnis von `lifestyle.export_own_data()`: je Tabelle eine Liste, dazu `exported_at` und `schema_version`. */
export type ExportJson = Record<string, unknown>;

// Welche Tabellen in welcher CSV landen. Alles andere steht nur in daten.json.
const CSV_DATEIEN: [string, string[]][] = [
  ["training.csv", ["workouts", "workout_sets", "activity_logs"]],
  ["ernaehrung.csv", ["meals", "water_logs"]],
  ["schlaf.csv", ["sleep_logs"]],
  ["koerperwerte.csv", ["body_measurements"]],
];

const text = (inhalt: string) => new TextEncoder().encode(inhalt);

function zeilen(exportJson: ExportJson, tabelle: string): CsvZeile[] {
  const liste = exportJson[tabelle];
  return Array.isArray(liste) ? liste.filter((z): z is CsvZeile => typeof z === "object" && z !== null) : [];
}

// Spalten kommen aus den Daten selbst, damit neue Spalten einer Tabelle ohne Codeänderung im Export stehen.
function csv(exportJson: ExportJson, tabellen: string[]): string {
  const alle = tabellen.flatMap((tabelle) => zeilen(exportJson, tabelle).map((z) => ({ ...z, tabelle })));
  const spalten = new Set(["tabelle", ...alle.flatMap((z) => Object.keys(z))]);
  return alsCsv(alle, [...spalten]);
}

// Annahme bis SIN-1304: Fotozeilen tragen `id`, `taken_on` (sonst `created_at`), `mime_type` und `image_base64`.
function fotos(exportJson: ExportJson): ZipDatei[] {
  const sicher = (wert: unknown) => String(wert ?? "").replace(/[^A-Za-z0-9_-]/g, "_");
  return zeilen(exportJson, "progress_photos").flatMap((foto) => {
    if (typeof foto.image_base64 !== "string") return [];
    const datum = sicher(String(foto.taken_on ?? foto.created_at ?? "").slice(0, 10));
    const typ = String(foto.mime_type ?? "").split("/")[1]?.replace(/[^a-z0-9]/g, "") || "bin";
    const name = `fotos/${datum}-${sicher(foto.id)}.${typ === "jpeg" ? "jpg" : typ}`;
    return [{ name, inhalt: new Uint8Array(Buffer.from(foto.image_base64, "base64")) }];
  });
}

const liesmich = (datum: string) => `Lifestyle App: Export deiner Daten
Erstellt am: ${datum}

daten.json        Alle deine Daten vollständig und maschinenlesbar, inklusive Einwilligungsprotokoll.
training.csv      Trainingseinheiten, Sätze und Aktivitäten.
ernaehrung.csv    Mahlzeiten und Wasser.
schlaf.csv        Schlaf.
koerperwerte.csv  Körperwerte.
fotos/            Deine Fortschrittsfotos als Originaldateien (nur vorhanden, wenn du Fotos gespeichert hast).

Die CSV-Dateien öffnest du mit Excel oder LibreOffice (Trennzeichen Semikolon, UTF-8).
Die Spalte "tabelle" nennt die Herkunft der Zeile. Texte, die mit =, +, - oder @ beginnen,
haben zum Schutz vor Formeln ein vorangestelltes Hochkomma.

Die Dateien enthalten Gesundheitsdaten. Bitte behandle sie privat.
`;

/** Baut die Dateien des Exports. Das ZIP daraus schreibt `baueZip`; Route und Datenbank liegen außerhalb. */
export function baueExportPaket(exportJson: ExportJson): ZipDatei[] {
  const datum = typeof exportJson.exported_at === "string" ? exportJson.exported_at : "unbekannt";
  return [
    { name: "daten.json", inhalt: text(JSON.stringify(exportJson, null, 2)) },
    ...CSV_DATEIEN.map(([name, tabellen]) => ({ name, inhalt: text(csv(exportJson, tabellen)) })),
    { name: "README.txt", inhalt: text(liesmich(datum)) },
    ...fotos(exportJson),
  ];
}
