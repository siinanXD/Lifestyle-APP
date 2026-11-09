// @vitest-environment node
import { describe, expect, test } from "vitest";
import { baueExportPaket } from "../../lib/export/paket";
import { baueZip } from "../../lib/export/zip";

const BOM = "﻿";
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);

// Erfundene Daten in der Form von lifestyle.export_own_data() (SIN-1304): je Tabelle eine Liste.
const exportJson = {
  exported_at: "2026-11-09T08:00:00Z",
  schema_version: 1,
  consents: [{ id: "c1", kind: "B", granted_at: "2026-11-01T10:00:00Z" }],
  workouts: [{ id: "w1", started_at: "2026-11-02T17:00:00Z", note: "=1+1" }],
  workout_sets: [{ id: "s1", workout_id: "w1", reps: 10, weight_kg: 20 }],
  meals: [{ id: "m1", name: "Reis; Huhn", kcal: 600 }],
  water_logs: [{ id: "wl1", amount_ml: 300 }],
  sleep_logs: [{ id: "sl1", hours: 7.5 }],
  body_measurements: [{ id: "b1", measured_on: "2026-11-03", weight_kg: 80.5 }],
  progress_photos: [
    { id: "p1", taken_on: "2026-11-04", mime_type: "image/jpeg", image_base64: jpg.toString("base64") },
  ],
};

const alsText = (dateien: ReturnType<typeof baueExportPaket>) =>
  Object.fromEntries(dateien.map((d) => [d.name, Buffer.from(d.inhalt).toString("utf8")]));

describe("baueExportPaket", () => {
  test("enthält daten.json vollständig, inklusive Einwilligungsprotokoll", () => {
    const dateien = alsText(baueExportPaket(exportJson));
    expect(JSON.parse(dateien["daten.json"])).toEqual(exportJson);
  });

  test("CSV-Dateien je Kategorie mit Tabellenspalte, maskiert und entschärft", () => {
    const dateien = alsText(baueExportPaket(exportJson));
    expect(dateien["training.csv"]).toBe(
      `${BOM}tabelle;id;started_at;note;workout_id;reps;weight_kg\r\n` +
        "workouts;w1;2026-11-02T17:00:00Z;'=1+1;;;\r\n" +
        "workout_sets;s1;;;w1;10;20\r\n",
    );
    expect(dateien["ernaehrung.csv"]).toBe(
      `${BOM}tabelle;id;name;kcal;amount_ml\r\nmeals;m1;"Reis; Huhn";600;\r\nwater_logs;wl1;;;300\r\n`,
    );
    expect(dateien["schlaf.csv"]).toBe(`${BOM}tabelle;id;hours\r\nsleep_logs;sl1;7.5\r\n`);
    expect(dateien["koerperwerte.csv"]).toBe(
      `${BOM}tabelle;id;measured_on;weight_kg\r\nbody_measurements;b1;2026-11-03;80.5\r\n`,
    );
  });

  test("Fotos liegen als Binärdatei unter fotos/<datum>-<id>.<ext>", () => {
    const foto = baueExportPaket(exportJson).find((d) => d.name.startsWith("fotos/"));
    expect(foto?.name).toBe("fotos/2026-11-04-p1.jpg");
    expect([...(foto?.inhalt ?? [])]).toEqual([...jpg]);
  });

  test("Foto-Dateiname enthält keine Pfadteile aus den Daten", () => {
    const dateien = baueExportPaket({
      progress_photos: [{ id: "../../x", taken_on: "2026-11-04", mime_type: "image/../png", image_base64: "AA==" }],
    });
    const namen = dateien.filter((d) => d.name.startsWith("fotos/")).map((d) => d.name);
    expect(namen).toHaveLength(1);
    expect(namen[0]).toMatch(/^fotos\/[A-Za-z0-9_-]+\.[a-z0-9]+$/);
  });

  test("README.txt erklärt die Dateien und nennt das Exportdatum", () => {
    const readme = alsText(baueExportPaket(exportJson))["README.txt"];
    expect(readme).toContain("2026-11-09");
    for (const name of ["daten.json", "training.csv", "ernaehrung.csv", "schlaf.csv", "koerperwerte.csv", "fotos/"]) {
      expect(readme).toContain(name);
    }
  });

  test("fehlende Kategorien ergeben leere CSV statt Fehler", () => {
    const dateien = alsText(baueExportPaket({}));
    expect(Object.keys(dateien)).toEqual([
      "daten.json",
      "training.csv",
      "ernaehrung.csv",
      "schlaf.csv",
      "koerperwerte.csv",
      "README.txt",
    ]);
    for (const name of ["training.csv", "ernaehrung.csv", "schlaf.csv", "koerperwerte.csv"]) {
      expect(dateien[name]).toBe(`${BOM}tabelle\r\n`);
    }
  });

  test("Paket lässt sich als ZIP schreiben", () => {
    expect(baueZip(baueExportPaket(exportJson)).length).toBeGreaterThan(22);
  });
});
