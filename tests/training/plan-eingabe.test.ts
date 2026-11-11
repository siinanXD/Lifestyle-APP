import { expect, test } from "vitest";
import { ladePlanEingabe, speicherePlan, type KatalogUebung } from "../../lib/training/plan-eingabe";
import type { Plan } from "../../lib/training/plan";

type Antwort = { data?: unknown; error?: unknown };

// Kette wie im Supabase-Client. Je Tabelle eine feste Antwort oder eine Funktion, die die Methoden der Kette sieht
// (z. B. ["insert"] oder ["update", "eq"]) und so Schreib- und Lesezugriffe unterscheidet.
function fake(ergebnisse: Record<string, Antwort | ((methoden: string[]) => Antwort)> = {}, user: { id: string } | null = { id: "u1" }) {
  const aufrufe: [string, string, unknown[]][] = [];
  const kette = (tabelle: string, methoden: string[]): object =>
    new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then") {
            const e = ergebnisse[tabelle] ?? { data: null, error: null };
            return (ok: (v: unknown) => unknown) => Promise.resolve(typeof e === "function" ? e(methoden) : e).then(ok);
          }
          return (...args: unknown[]) => {
            aufrufe.push([tabelle, String(prop), args]);
            return kette(tabelle, [...methoden, String(prop)]);
          };
        },
      },
    );
  const client = { auth: { getUser: async () => ({ data: { user } }) }, from: (tabelle: string) => kette(tabelle, []) };
  return { client: client as never, aufrufe };
}

const uebung = { id: "e1", slug: "kniebeuge", name: "Kniebeuge", category: "bodyweight" as const, muscle_groups: ["beine"], equipment: [] as string[] };
const profil = { goals: ["kraeftiger"], days_per_week: 2, minutes_per_session: 30, experience: "regelmaessig", equipment: ["kurzhanteln"] };
const vorHeute = (tage: number) => new Date(Date.now() - tage * 24 * 60 * 60 * 1000).toISOString();

test("ohne Einwilligung B: keine Einschränkungen, kein Lesen von Gesundheitsdaten, Hinweis gesetzt", async () => {
  const { client, aufrufe } = fake({
    consents: { data: [{ kind: "A", revoked_at: null }, { kind: "B", revoked_at: "2026-11-01T00:00:00Z" }], error: null },
    profiles: { data: profil, error: null },
    health_profile: { data: { restrictions: ["knie"] }, error: null },
    comeback_checkins: { data: { level: 2, created_at: vorHeute(1) }, error: null },
    exercises: { data: [uebung], error: null },
  });
  const r = await ladePlanEingabe(client);
  if (!r.ok) throw new Error(r.fehler);
  expect(r.daten.ohneBeschwerden).toBe(true);
  expect(r.daten.angaben.einschraenkungen).toBeUndefined();
  expect(r.daten.angaben.comebackStufe).toBeUndefined();
  expect(r.daten.angaben).toMatchObject({ ziele: ["kraeftiger"], tageProWoche: 2, minutenProEinheit: 30, erfahrung: "regelmaessig", geraete: ["kurzhanteln"] });
  const tabellen = aufrufe.map(([t]) => t);
  expect(tabellen).not.toContain("health_profile");
  expect(tabellen).not.toContain("comeback_checkins");
});

test("mit Einwilligung B: Einschränkungen und frische Comeback-Stufe fließen ein", async () => {
  const { client } = fake({
    consents: { data: [{ kind: "B", revoked_at: null }], error: null },
    profiles: { data: profil, error: null },
    health_profile: { data: { restrictions: ["knie"] }, error: null },
    comeback_checkins: { data: { level: 2, created_at: vorHeute(3) }, error: null },
    exercises: { data: [uebung], error: null },
  });
  const r = await ladePlanEingabe(client);
  if (!r.ok) throw new Error(r.fehler);
  expect(r.daten.ohneBeschwerden).toBe(false);
  expect(r.daten.angaben.einschraenkungen).toEqual(["knie"]);
  expect(r.daten.angaben.comebackStufe).toBe(2);
});

test("eine alte Comeback-Angabe zählt nicht mehr", async () => {
  const { client } = fake({
    consents: { data: [{ kind: "B", revoked_at: null }], error: null },
    comeback_checkins: { data: { level: 3, created_at: vorHeute(40) }, error: null },
    exercises: { data: [], error: null },
  });
  const r = await ladePlanEingabe(client);
  if (!r.ok) throw new Error(r.fehler);
  expect(r.daten.angaben.comebackStufe).toBeUndefined();
});

test("leeres Profil ergibt leere Angaben; Katalog bekommt joints und variant_of als Platzhalter", async () => {
  const { client } = fake({ consents: { data: [], error: null }, profiles: { data: { goals: [], equipment: [] }, error: null }, exercises: { data: [uebung], error: null } });
  const r = await ladePlanEingabe(client);
  if (!r.ok) throw new Error(r.fehler);
  expect(r.daten.angaben).toEqual({});
  expect(r.daten.katalog).toEqual([{ ...uebung, joints: [], variant_of: null }]);
});

test("Lesefehler kommt als Ergebnis zurück", async () => {
  const { client } = fake({ consents: { data: [], error: null }, profiles: { data: null, error: { code: "42501" } } });
  expect(await ladePlanEingabe(client)).toEqual({ ok: false, fehler: "42501" });
});

const plan: Plan<KatalogUebung> = {
  allgemein: true,
  hinweise: [],
  tage: [
    { tagNr: 1, bezeichnung: "Ganzkörper", positionen: [{ uebung: { ...uebung, joints: [], variant_of: null }, saetze: 2, wdhMin: 10, wdhMax: 15 }] },
    { tagNr: 2, bezeichnung: "Ganzkörper", positionen: [{ uebung: { ...uebung, joints: [], variant_of: null }, saetze: 2, wdhMin: 10, wdhMax: 15 }] },
  ],
};

// training_plans: select = alter aktiver Plan, insert = neuer Plan, sonst update/delete.
const plaene = (m: string[]): Antwort =>
  m[0] === "select" ? { data: { id: "alt" }, error: null } : m[0] === "insert" ? { data: { id: "neu" }, error: null } : { data: null, error: null };

test("Übernehmen speichert Plan und Positionen und löst den alten Plan ab", async () => {
  const { client, aufrufe } = fake({ training_plans: plaene, plan_items: { data: null, error: null } });
  expect(await speicherePlan(client, plan)).toEqual({ ok: true, daten: { id: "neu" } });
  const schreiben = aufrufe.filter(([, m]) => ["insert", "update", "delete"].includes(m));
  expect(schreiben.map(([t, m]) => `${t}.${m}`)).toEqual(["training_plans.insert", "plan_items.insert", "training_plans.update", "training_plans.update"]);
  // Der neue Plan entsteht inaktiv; aktiv wird er erst, wenn die Positionen stehen und der alte abgelöst ist.
  expect(schreiben[0][2][0]).toMatchObject({ user_id: "u1", source: "regeln", general: true, active: false });
  expect(schreiben[1][2][0]).toEqual([
    { plan_id: "neu", user_id: "u1", day_no: 1, position: 1, exercise_id: "e1", sets: 2, rep_min: 10, rep_max: 15 },
    { plan_id: "neu", user_id: "u1", day_no: 2, position: 1, exercise_id: "e1", sets: 2, rep_min: 10, rep_max: 15 },
  ]);
  expect(schreiben[2][2][0]).toEqual({ active: false });
  expect(schreiben[3][2][0]).toEqual({ active: true });
});

test("Fehler im zweiten Schritt: alter Plan bleibt aktiv, der halbe neue wird entfernt", async () => {
  const { client, aufrufe } = fake({ training_plans: plaene, plan_items: { data: null, error: { code: "23503" } } });
  expect(await speicherePlan(client, plan)).toEqual({ ok: false, fehler: "23503" });
  const schreiben = aufrufe.filter(([, m]) => ["insert", "update", "delete"].includes(m)).map(([t, m]) => `${t}.${m}`);
  expect(schreiben).toEqual(["training_plans.insert", "plan_items.insert", "training_plans.delete"]);
});

test("Fehler beim Aktivieren: alter Plan wird wieder aktiv", async () => {
  let updates = 0;
  const { client, aufrufe } = fake({
    training_plans: (m) => (m[0] === "update" && ++updates === 2 ? { data: null, error: { code: "23505" } } : plaene(m)),
    plan_items: { data: null, error: null },
  });
  expect(await speicherePlan(client, plan)).toEqual({ ok: false, fehler: "23505" });
  const updatesGesendet = aufrufe.filter(([, m]) => m === "update").map(([, , a]) => a[0]);
  expect(updatesGesendet).toEqual([{ active: false }, { active: true }, { active: true }]);
  expect(aufrufe.some(([t, m]) => t === "training_plans" && m === "delete")).toBe(true);
});

test("ohne Übungen wird nichts gespeichert", async () => {
  const { client, aufrufe } = fake();
  expect(await speicherePlan(client, { allgemein: true, hinweise: [], tage: [{ tagNr: 1, bezeichnung: "Ganzkörper", positionen: [] }] })).toEqual({ ok: false, fehler: "leer" });
  expect(aufrufe).toEqual([]);
});
