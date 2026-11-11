import { beforeEach, describe, expect, test, vi } from "vitest";
import { demoServerClient } from "../../lib/demo/server";
import { setzeZurueck } from "../../lib/demo/db";
import { erstellePlan } from "../../lib/training/plan";
import {
  aenderePosition,
  entfernePosition,
  ladeAktivenPlan,
  ladePlantag,
  letzterPlantag,
  loeschePlan,
  naechsterTag,
  starteWorkoutAusPlan,
} from "../../lib/training/plan-ablauf";
import { ladePlanEingabe, speicherePlan } from "../../lib/training/plan-eingabe";

describe("naechsterTag", () => {
  test("ohne Verlauf Tag 1", () => expect(naechsterTag([1, 2, 3])).toBe(1));
  test("nach Tag 1 kommt 2", () => expect(naechsterTag([1, 2, 3], 1)).toBe(2));
  test("nach dem letzten wieder 1", () => expect(naechsterTag([1, 2, 3], 3)).toBe(1));
  test("Reihenfolge und Dopplungen der Eingabe sind egal", () => expect(naechsterTag([3, 1, 1, 2], 2)).toBe(3));
  test("zuletzt trainierter Tag gibt es nicht mehr: nächsthöherer, sonst der erste", () => {
    expect(naechsterTag([1, 3], 2)).toBe(3);
    expect(naechsterTag([1, 2], 5)).toBe(1);
  });
  test("Plan ohne Tage: nichts dran", () => expect(naechsterTag([], 1)).toBeUndefined());
});

// Gegen den Demo-Speicher (lib/demo): derselbe Abfrageweg wie mit Supabase, ohne Datenbank.
describe("Plan im Speicher", () => {
  const client = () => demoServerClient() as never;
  beforeEach(async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "on");
    setzeZurueck();
    const eingabe = await ladePlanEingabe(client());
    if (!eingabe.ok) throw new Error(eingabe.fehler);
    const r = await speicherePlan(client(), erstellePlan(eingabe.daten.angaben, eingabe.daten.katalog));
    if (!r.ok) throw new Error(r.fehler);
  });

  const plan = async () => {
    const r = await ladeAktivenPlan(client());
    if (!r.ok || !r.daten) throw new Error("kein Plan");
    return r.daten;
  };

  test("aktiver Plan kommt mit Tagen, Übungsnamen und Vorgaben; ohne Plan null", async () => {
    const p = await plan();
    expect(p.source).toBe("regeln");
    expect(p.tage.map((t) => t.tagNr)).toEqual([1, 2, 3]);
    expect(p.tage[0].positionen[0]).toMatchObject({ name: expect.any(String), sets: 2, rep_min: 10, rep_max: 15 });
    await loeschePlan(client(), p.id);
    expect(await ladeAktivenPlan(client())).toEqual({ ok: true, daten: null });
  });

  test("Training aus dem Plan trägt den Planbezug; danach ist der nächste Tag dran", async () => {
    const p = await plan();
    expect(await letzterPlantag(client(), p.id)).toEqual({ ok: true, daten: null });
    const w = await starteWorkoutAusPlan(client(), { id: "w1", planId: p.id, tagNr: 1 });
    expect(w).toEqual({ ok: true, daten: { id: "w1" } });
    const zuletzt = await letzterPlantag(client(), p.id);
    expect(zuletzt).toEqual({ ok: true, daten: 1 });
    expect(naechsterTag(p.tage.map((t) => t.tagNr), zuletzt.ok ? zuletzt.daten : null)).toBe(2);
    const tag = await ladePlantag(client(), p.id, 2);
    expect(tag.ok && tag.daten.map((x) => x.id)).toEqual(p.tage[1].positionen.map((x) => x.id));
  });

  test("Übung austauschen speichert und setzt source auf manuell", async () => {
    const p = await plan();
    const pos = p.tage[0].positionen[0];
    const r = await aenderePosition(client(), p.id, pos.id, { exercise_id: "demo-joggen", sets: 4, rep_min: 6, rep_max: 8 });
    expect(r.ok).toBe(true);
    const neu = await plan();
    expect(neu.source).toBe("manuell");
    expect(neu.tage[0].positionen[0]).toMatchObject({ exercise_id: "demo-joggen", name: "Joggen", sets: 4, rep_min: 6, rep_max: 8 });
  });

  test("ungültige Vorgaben werden nicht gespeichert", async () => {
    const p = await plan();
    const pos = p.tage[0].positionen[0];
    expect(await aenderePosition(client(), p.id, pos.id, { exercise_id: pos.exercise_id, sets: 0, rep_min: 12, rep_max: 8 })).toEqual({ ok: false, fehler: "ungueltig" });
    expect((await plan()).source).toBe("regeln");
  });

  test("Übung entfernen setzt source auf manuell", async () => {
    const p = await plan();
    const anzahl = p.tage[0].positionen.length;
    expect((await entfernePosition(client(), p.id, p.tage[0].positionen[0].id)).ok).toBe(true);
    const neu = await plan();
    expect(neu.tage[0].positionen).toHaveLength(anzahl - 1);
    expect(neu.source).toBe("manuell");
  });
});
