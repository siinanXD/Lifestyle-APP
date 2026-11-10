// @vitest-environment node
import { describe, expect, test } from "vitest";
import { alsCsv } from "../../lib/export/csv";

const BOM = "﻿";

describe("alsCsv", () => {
  test("UTF-8-BOM, Trennzeichen ; und Zeilenende CRLF", () => {
    expect(alsCsv([{ a: 1, b: "Müsli" }], ["a", "b"])).toBe(`${BOM}a;b\r\n1;Müsli\r\n`);
  });

  test("Komma, Semikolon, Anführungszeichen und Zeilenumbruch werden maskiert", () => {
    const csv = alsCsv(
      [{ a: "Reis, Huhn", b: "halb;voll", c: 'sagt "satt"', d: "Zeile 1\nZeile 2" }],
      ["a", "b", "c", "d"],
    );
    expect(csv).toBe(`${BOM}a;b;c;d\r\n"Reis, Huhn";"halb;voll";"sagt ""satt""";"Zeile 1\nZeile 2"\r\n`);
  });

  test("Formelzellen werden entschärft", () => {
    const csv = alsCsv([{ a: "=SUMME(A1:A9)", b: "+49", c: "-1+1", d: "@cmd" }], ["a", "b", "c", "d"]);
    expect(csv).toBe(`${BOM}a;b;c;d\r\n'=SUMME(A1:A9);'+49;'-1+1;'@cmd\r\n`);
  });

  test("Zahlen bleiben Zahlen, auch negative", () => {
    expect(alsCsv([{ a: -2.5 }], ["a"])).toBe(`${BOM}a\r\n-2.5\r\n`);
  });

  test("leere Liste: nur Kopfzeile", () => {
    expect(alsCsv([], ["a", "b"])).toBe(`${BOM}a;b\r\n`);
  });

  test("fehlende Werte sind leer, Objekte stehen als JSON in der Zelle", () => {
    expect(alsCsv([{ a: null, c: { x: 1 } }], ["a", "b", "c"])).toBe(`${BOM}a;b;c\r\n;;"{""x"":1}"\r\n`);
  });
});

describe("alsCsv: Formelschutz", () => {
  test("entschärft Formeln auch hinter führenden Steuer- und Leerzeichen", () => {
    const csv = alsCsv([{ a: "\t=1+1", b: "\r@SUM(A1)", c: " +49 30", d: "ruhig", e: -5 }], ["a", "b", "c", "d", "e"]);
    const zeile = csv.split("\r\n")[1];
    expect(zeile.startsWith("'\t=1+1;")).toBe(true);
    expect(zeile).toContain("\"'\r@SUM(A1)\"");
    expect(zeile).toContain(";' +49 30;ruhig;-5");
  });
});
