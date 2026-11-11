import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "../../app/demo/db/route";
import { demoClient, sendeAnRoute } from "../../lib/demo/client";
import { fuehreAbfrage, setzeZurueck } from "../../lib/demo/db";
import { DEMO_NUTZER, istDemo } from "../../lib/demo/modus";
import { demoServerClient } from "../../lib/demo/server";
import { trageWasserEin, wasserSeit } from "../../lib/essen/wasser";
import { createClient as browserClient } from "../../lib/supabase/client";
import { letzteWorkouts, saetzeDesWorkouts, speichereSatz, starteWorkout } from "../../lib/training/log";
import { erstellePlan } from "../../lib/training/plan";
import { ladePlanEingabe, speicherePlan } from "../../lib/training/plan-eingabe";
import { proxy } from "../../proxy";

beforeEach(() => {
  setzeZurueck();
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "on");
});
afterEach(() => vi.unstubAllEnvs());

const client = () => demoServerClient() as never;

describe("Schalter", () => {
  test("ohne Schalter ist der Demo-Modus aus", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    expect(istDemo()).toBe(false);
  });

  test("in Produktion ist er trotz Schalter aus", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(istDemo()).toBe(false);
  });

  test("ohne Schalter antwortet die Demo-Route mit 404 und der Route-Schutz verlangt die Anmeldung", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    const antwort = await POST(new Request("http://localhost/demo/db", { method: "POST", body: JSON.stringify({ tabelle: "profiles", ops: [] }) }));
    expect(antwort.status).toBe(404);
    const res = await proxy(new NextRequest("http://localhost:3000/konto"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  test("mit Schalter lässt der Route-Schutz geschützte Seiten ohne Anmeldung und ohne Supabase-Variablen durch", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const res = await proxy(new NextRequest("http://localhost:3000/konto"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("Speicher", () => {
  test("Startdaten: Demo-Nutzer mit Profil, Einwilligungen A und B, Übungen", async () => {
    const c = demoServerClient() as unknown as ReturnType<typeof browserClient>;
    expect((await c.auth.getUser()).data.user?.id).toBe(DEMO_NUTZER.id);
    const profil = await c.from("profiles").select("onboarding_completed_at, equipment").maybeSingle();
    expect(profil.data).toMatchObject({ equipment: ["kurzhanteln"] });
    const offen = await c.from("consents").select("kind, revoked_at").is("revoked_at", null);
    expect((offen.data as { kind: string }[]).map((z) => z.kind).sort()).toEqual(["A", "B"]);
    const suche = await c.from("exercises").select("id, name").ilike("name", "%kniebeuge%").order("name");
    expect((suche.data as { name: string }[]).map((z) => z.name)).toEqual(["Kniebeuge (Körpergewicht)", "Kniebeuge mit Langhantel"]);
  });

  test("Wasser: eintragen und lesen", async () => {
    const r = await trageWasserEin(client(), 250);
    expect(r).toMatchObject({ ok: true, daten: { amount_ml: 250 } });
    const liste = await wasserSeit(client(), new Date(Date.now() - 1000).toISOString());
    expect(liste.ok && liste.daten).toHaveLength(1);
  });

  test("Training: Workout starten, Satz speichern, doppelten Satz ablehnen, Satz mit Übungsname lesen", async () => {
    const w = await starteWorkout(client());
    if (!w.ok) throw new Error(w.fehler);
    const satz = { workoutId: w.daten.id, exerciseId: "demo-rudern-kurzhantel", satzNr: 1, wdh: 12, gewichtKg: 10, technik: "sauber" as const, schmerz: false };
    expect(await speichereSatz(client(), satz, { nurNeu: true })).toEqual({ ok: true, daten: null });
    expect(await speichereSatz(client(), satz, { nurNeu: true })).toEqual({ ok: false, fehler: "23505" });
    expect(await speichereSatz(client(), { ...satz, wdh: 10 })).toEqual({ ok: true, daten: null });
    const saetze = await saetzeDesWorkouts(client(), w.daten.id);
    expect(saetze.ok && saetze.daten).toMatchObject([{ reps: 10, exercises: { name: "Rudern mit Kurzhantel" }, workouts: { regeneration: null } }]);
    const letzte = await letzteWorkouts(client(), 5);
    expect(letzte.ok && letzte.daten.map((x) => x.id)).toEqual([w.daten.id]);
  });

  test("Plan: Vorschlag aus den Demo-Angaben speichern, ein zweiter löst den ersten ab", async () => {
    const eingabe = await ladePlanEingabe(client());
    if (!eingabe.ok) throw new Error(eingabe.fehler);
    const plan = erstellePlan(eingabe.daten.angaben, eingabe.daten.katalog);
    const erster = await speicherePlan(client(), plan);
    const zweiter = await speicherePlan(client(), plan);
    if (!erster.ok || !zweiter.ok) throw new Error("Plan nicht gespeichert");
    const aktiv = fuehreAbfrage("training_plans", [{ m: "select", a: ["id"] }, { m: "eq", a: ["active", true] }]);
    expect(aktiv.data).toEqual([{ id: zweiter.daten.id }]);
    const positionen = fuehreAbfrage("plan_items", [{ m: "select", a: ["id"] }, { m: "eq", a: ["plan_id", zweiter.daten.id] }]);
    expect((positionen.data as unknown[]).length).toBeGreaterThan(0);
  });

  test("ändern, löschen, single ohne Treffer, Konto löschen setzt zurück", async () => {
    const c = demoServerClient() as unknown as ReturnType<typeof browserClient>;
    await c.from("profiles").update({ days_per_week: 5 }).eq("id", DEMO_NUTZER.id);
    expect((await c.from("profiles").select("days_per_week").single()).data).toEqual({ days_per_week: 5 });
    await c.from("consents").delete().eq("kind", "A");
    expect((await c.from("consents").select("kind")).data).toEqual([{ kind: "B" }]);
    expect((await c.from("consents").select("kind").eq("kind", "A").single()).error?.code).toBe("PGRST116");
    expect((await c.rpc("delete_own_data")).error).toBeNull();
    expect((await c.from("profiles").select("days_per_week").single()).data).toEqual({ days_per_week: 3 });
  });
});

describe("Browser-Client", () => {
  test("schickt die Kette an /demo/db und bekommt dieselbe Antwort wie der Server", async () => {
    // fetch auf die Route umleiten: so läuft derselbe Weg wie im Browser.
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => POST(new Request(`http://localhost${url}`, init)));
    const c = demoClient(sendeAnRoute) as unknown as ReturnType<typeof browserClient>;
    const eingefuegt = await c.from("water_logs").insert({ user_id: DEMO_NUTZER.id, amount_ml: 500 }).select("id, amount_ml").single();
    expect(eingefuegt.data).toMatchObject({ amount_ml: 500 });
    expect((await demoServerClient().from("water_logs") as unknown as { data: unknown[] }).data).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  test("createClient liefert im Demo-Modus den Demo-Client, ganz ohne Supabase-Variablen", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect((await browserClient().auth.getUser()).data.user?.id).toBe(DEMO_NUTZER.id);
  });

  test("ungültige Anfrage an die Route → 400; Netzfehler kommt als Fehler-Antwort zurück", async () => {
    expect((await POST(new Request("http://localhost/demo/db", { method: "POST", body: "{}" }))).status).toBe(400);
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    expect(await sendeAnRoute({ tabelle: "profiles", ops: [] })).toMatchObject({ data: null, error: { code: "netz" } });
    vi.unstubAllGlobals();
  });
});
