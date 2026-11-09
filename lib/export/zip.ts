export type ZipDatei = { name: string; inhalt: Uint8Array };

const CRC_TABELLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(daten: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of daten) c = CRC_TABELLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Einheitlich `/`; abgewiesen werden leere Namen, absolute Pfade, Laufwerke und Teile wie `..`. */
function eintragsname(name: string): string {
  const normal = name.replaceAll("\\", "/");
  const ungueltig =
    normal.startsWith("/") || /^[A-Za-z]:/.test(normal) || normal.split("/").some((t) => t === "" || t === "." || t === "..");
  if (ungueltig) throw new Error(`Ungültiger Eintragsname im ZIP: ${JSON.stringify(name)}`);
  return normal;
}

/**
 * Minimaler ZIP-Schreiber im Modus „stored“ (ohne Kompression), damit der Export keine Abhängigkeit braucht.
 * shortcut: kein ZIP64 (höchstens 65535 Einträge und 4 GB), bei größeren Exporten auf `fflate` wechseln.
 */
export function baueZip(dateien: ZipDatei[], zeitpunkt: Date = new Date()): Uint8Array {
  const dosZeit = (zeitpunkt.getHours() << 11) | (zeitpunkt.getMinutes() << 5) | (zeitpunkt.getSeconds() >> 1);
  const dosDatum =
    (Math.max(zeitpunkt.getFullYear() - 1980, 0) << 9) | ((zeitpunkt.getMonth() + 1) << 5) | zeitpunkt.getDate();

  const teile: Uint8Array[] = [];
  const verzeichnis: Uint8Array[] = [];
  let versatz = 0;

  for (const datei of dateien) {
    const name = new TextEncoder().encode(eintragsname(datei.name));
    const groesse = datei.inhalt.length;
    const crc = crc32(datei.inhalt);

    // Gemeinsame Felder von lokalem Kopf und Verzeichniseintrag: Version bis Länge des Zusatzfelds.
    const felder = new DataView(new ArrayBuffer(26));
    felder.setUint16(0, 20, true); // benötigte Version 2.0
    felder.setUint16(2, 0x0800, true); // Namen sind UTF-8
    felder.setUint16(4, 0, true); // stored
    felder.setUint16(6, dosZeit, true);
    felder.setUint16(8, dosDatum, true);
    felder.setUint32(10, crc, true);
    felder.setUint32(14, groesse, true);
    felder.setUint32(18, groesse, true);
    felder.setUint16(22, name.length, true);
    const gemeinsam = new Uint8Array(felder.buffer);

    const lokal = new Uint8Array(30 + name.length);
    new DataView(lokal.buffer).setUint32(0, 0x04034b50, true);
    lokal.set(gemeinsam, 4);
    lokal.set(name, 30);

    const eintrag = new Uint8Array(46 + name.length);
    const sicht = new DataView(eintrag.buffer);
    sicht.setUint32(0, 0x02014b50, true);
    sicht.setUint16(4, 20, true); // erstellt mit Version 2.0
    eintrag.set(gemeinsam, 6);
    sicht.setUint32(42, versatz, true);
    eintrag.set(name, 46);

    teile.push(lokal, datei.inhalt);
    verzeichnis.push(eintrag);
    versatz += lokal.length + groesse;
  }

  const verzeichnisGroesse = verzeichnis.reduce((summe, e) => summe + e.length, 0);
  if (dateien.length > 0xffff || versatz + verzeichnisGroesse > 0xffffffff) {
    throw new Error("Export ist zu groß für ein ZIP ohne ZIP64");
  }
  const ende = new DataView(new ArrayBuffer(22));
  ende.setUint32(0, 0x06054b50, true);
  ende.setUint16(8, dateien.length, true);
  ende.setUint16(10, dateien.length, true);
  ende.setUint32(12, verzeichnisGroesse, true);
  ende.setUint32(16, versatz, true);

  const zip = new Uint8Array(versatz + verzeichnisGroesse + 22);
  let pos = 0;
  for (const teil of [...teile, ...verzeichnis, new Uint8Array(ende.buffer)]) {
    zip.set(teil, pos);
    pos += teil.length;
  }
  return zip;
}
