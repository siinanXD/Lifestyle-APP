import { createClient } from "@supabase/supabase-js";
import { describe, expect, test } from "vitest";
import { erteileEinwilligung } from "../../lib/consent/consent";
import { beendeWorkout, saetzeDesWorkouts, speichereSatz, starteWorkout } from "../../lib/training/log";

// Lokaler Stack: `supabase start` + `supabase db reset`, dann SUPABASE_URL und SUPABASE_ANON_KEY aus `supabase status -o env` setzen.
const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey } = process.env;

const neuerClient = () => createClient(url!, anonKey!, { db: { schema: "lifestyle" }, auth: { persistSession: false } });
// log.ts ist auf den Typ des Browser-Clients geschrieben; die Abfrage-API ist dieselbe.
const alsLogClient = (c: unknown) => c as never;

async function konto(name: string) {
  const client = neuerClient();
  const { error } = await client.auth.signUp({ email: `${name}-${Date.now()}@example.test`, password: "platzhalter-123" });
  if (error) throw error;
  // Mit Einwilligung B, sonst scheitert Bs Schreibversuch unten an der Einwilligung statt am fremden Workout.
  const einwilligung = await erteileEinwilligung(alsLogClient(client), "B");
  if (einwilligung.error) throw einwilligung.error;
  return client;
}

describe.skipIf(!url || !anonKey)("Trainingsweg „Rudern, 3 × 12“ gegen lokalen Stack (SIN-1275)", () => {
  test("A speichert und sieht es nach dem Neuladen wieder; B liest es auch direkt nicht", async () => {
    const a = await konto("rudern-a");
    const { data: rudern, error } = await a.from("exercises").select("id").eq("slug", "rudern-kurzhantel").single<{ id: string }>();
    expect(error).toBeNull();
    const workout = await starteWorkout(alsLogClient(a), { id: crypto.randomUUID() });
    if (!workout.ok) throw new Error(workout.fehler);
    const workoutId = workout.daten.id;
    const satz = { workoutId, exerciseId: rudern!.id, wdh: 12, gewichtKg: 20, technik: "sauber" as const, schmerz: false };
    for (const satzNr of [1, 2, 3]) expect(await speichereSatz(alsLogClient(a), { ...satz, satzNr })).toEqual({ ok: true, daten: null });
    expect((await beendeWorkout(alsLogClient(a), workoutId, {})).ok).toBe(true);

    // „Neu laden“: frischer Client mit der Sitzung von A
    const { data: sitzung } = await a.auth.getSession();
    const a2 = neuerClient();
    await a2.auth.setSession({ access_token: sitzung.session!.access_token, refresh_token: sitzung.session!.refresh_token });
    const wieder = await saetzeDesWorkouts(alsLogClient(a2), workoutId);
    expect(wieder.ok && wieder.daten.map((s) => [s.exercises?.name, s.set_no, s.reps])).toEqual([
      ["Rudern mit Kurzhantel", 1, 12],
      ["Rudern mit Kurzhantel", 2, 12],
      ["Rudern mit Kurzhantel", 3, 12],
    ]);

    const b = await konto("rudern-b");
    expect(await saetzeDesWorkouts(alsLogClient(b), workoutId)).toEqual({ ok: true, daten: [] });
    expect((await b.from("workout_sets").select("*").eq("workout_id", workoutId)).data).toEqual([]);
    expect((await b.from("workouts").select("*").eq("id", workoutId)).data).toEqual([]);
    expect((await speichereSatz(alsLogClient(b), { ...satz, satzNr: 4 })).ok).toBe(false);
  });
});
