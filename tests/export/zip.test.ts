// @vitest-environment node
import { crc32 } from "node:zlib";
import { describe, expect, test } from "vitest";
import { baueZip } from "../../lib/export/zip";

const text = (s: string) => new TextEncoder().encode(s);

// Unabhängiger Leser: geht vom Verzeichnis am Ende aus und prüft jede Signatur, Größe und CRC (node:zlib).
function liesZip(zip: Uint8Array) {
  const b = Buffer.from(zip);
  const ende = b.length - 22;
  expect(b.readUInt32LE(ende)).toBe(0x06054b50);
  const anzahl = b.readUInt16LE(ende + 10);
  expect(b.readUInt16LE(ende + 8)).toBe(anzahl);
  let pos = b.readUInt32LE(ende + 16);
  expect(pos + b.readUInt32LE(ende + 12)).toBe(ende);

  const eintraege: Record<string, Buffer> = {};
  for (let i = 0; i < anzahl; i++) {
    expect(b.readUInt32LE(pos)).toBe(0x02014b50);
    expect(b.readUInt16LE(pos + 10)).toBe(0); // stored
    const crc = b.readUInt32LE(pos + 16);
    const groesse = b.readUInt32LE(pos + 24);
    expect(b.readUInt32LE(pos + 20)).toBe(groesse);
    const nameLaenge = b.readUInt16LE(pos + 28);
    const lokal = b.readUInt32LE(pos + 42);
    const name = b.toString("utf8", pos + 46, pos + 46 + nameLaenge);

    expect(b.readUInt32LE(lokal)).toBe(0x04034b50);
    expect(b.readUInt32LE(lokal + 14)).toBe(crc);
    expect(b.readUInt32LE(lokal + 18)).toBe(groesse);
    expect(b.readUInt32LE(lokal + 22)).toBe(groesse);
    expect(b.toString("utf8", lokal + 30, lokal + 30 + nameLaenge)).toBe(name);
    const start = lokal + 30 + nameLaenge + b.readUInt16LE(lokal + 28);
    const daten = b.subarray(start, start + groesse);
    expect(crc32(daten)).toBe(crc);

    eintraege[name] = daten;
    pos += 46 + nameLaenge;
  }
  expect(pos).toBe(ende);
  return eintraege;
}

describe("baueZip", () => {
  test("Einträge sind unabhängig lesbar: Signaturen, Größen, CRC und Inhalt stimmen", () => {
    const zip = baueZip([
      { name: "daten.json", inhalt: text('{"a":1}') },
      { name: "fotos/2026-11-01-übung.jpg", inhalt: new Uint8Array([0xff, 0xd8, 0x00, 0xff]) },
      { name: "leer.csv", inhalt: new Uint8Array() },
    ]);
    const eintraege = liesZip(zip);
    expect(Object.keys(eintraege)).toEqual(["daten.json", "fotos/2026-11-01-übung.jpg", "leer.csv"]);
    expect(eintraege["daten.json"].toString("utf8")).toBe('{"a":1}');
    expect([...eintraege["fotos/2026-11-01-übung.jpg"]]).toEqual([0xff, 0xd8, 0x00, 0xff]);
    expect(eintraege["leer.csv"].length).toBe(0);
  });

  test("leeres Archiv besteht nur aus dem Endverzeichnis", () => {
    expect(liesZip(baueZip([]))).toEqual({});
  });

  test("Rückwärtsstriche werden zu Schrägstrichen", () => {
    expect(Object.keys(liesZip(baueZip([{ name: "fotos\\a.png", inhalt: text("x") }])))).toEqual(["fotos/a.png"]);
  });

  test.each(["../x", "fotos/../../x", "..\\x", "/etc/x", "C:/x", "", "fotos//x", "fotos/"])(
    "Pfad %j wird abgewiesen",
    (name) => {
      expect(() => baueZip([{ name, inhalt: text("x") }])).toThrow(/Eintragsname/);
    },
  );
});

describe("baueZip: Namenslänge", () => {
  test("lehnt Namen ab, deren UTF-8-Länge nicht ins Längenfeld passt", () => {
    const inhalt = new Uint8Array([1]);
    expect(() => baueZip([{ name: "a".repeat(65536), inhalt }])).toThrow(/zu lang/);
    expect(() => baueZip([{ name: "ä".repeat(32768), inhalt }])).toThrow(/zu lang/);
    expect(baueZip([{ name: "a".repeat(65535), inhalt }]).length).toBeGreaterThan(65535 * 2);
  });
});
