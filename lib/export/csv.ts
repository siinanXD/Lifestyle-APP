export type CsvZeile = Record<string, unknown>;

function zelle(wert: unknown): string {
  if (wert === null || wert === undefined) return "";
  let text = typeof wert === "object" ? JSON.stringify(wert) : String(wert);
  // Formel-Einschleusung: nur Texte entschärfen, damit negative Zahlen Zahlen bleiben.
  // Auch hinter führenden Steuer- und Leerzeichen (Tab, CR): Tabellenprogramme überlesen sie.
  if (typeof wert === "string" && /^[\u0000- ]*[=+\-@]/.test(text)) text = `'${text}`;
  return /[";,\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** CSV für Excel in deutscher Einstellung: UTF-8 mit BOM, Trennzeichen `;`, Zeilenende CRLF. */
export function alsCsv(zeilen: CsvZeile[], spalten: string[]): string {
  const kopf = spalten.map(zelle).join(";");
  const rumpf = zeilen.map((zeile) => spalten.map((spalte) => zelle(zeile[spalte])).join(";"));
  return "﻿" + [kopf, ...rumpf].map((z) => `${z}\r\n`).join("");
}
