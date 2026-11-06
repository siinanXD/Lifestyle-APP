import { createClient } from "@supabase/supabase-js";
import { describe, expect, test } from "vitest";
import { beendeWorkout, saetzeDesWorkouts, speichereSatz, starteWorkout } from "../../lib/training/log";

// Lokaler Stack: `supabase start` + `supabase db reset`, dann SUPABASE_URL und SUPABASE_ANON_KEY aus `supabase status -o env` setzen.
const { SUPABASE_URL: url, SUPABASE_ANON_KEY: anonKey } = process.env;

async function konto(name: string) {
  const client = createClient(url!, anonKey!, { db: { schema: "lifestyle" }, auth: { persistSession: false } });
  const { error } = await client.auth.signUp({ email: `${name}-${Date.now()}@example.test`, password: "platzhalter-123" });
  if (error) throw error;
  return client as never;
}

describe.skipIf(!url || !anonKey)("Trainingsweg „Rudern, 3 × 12“ gegen lokalen Stack (SIN-1275)", () => {
  test("A speichert und sieht es nach dem Neuladen wieder; B liest es auch direkt nicht", async () => {
    const a = await konto("rudern-a");
    const { data: rudern } = await (a as ReturnType<typeof createClient>).from("exercises").select("id").eq("slug", "rudern-kurzhantel").single();
    const workout = await starteWorkout(a, { id: crypto.randomUUID() });
    expect(workout.ok).toBe(true);
    const workoutId = (workout as { daten: { id: string } }).daten.id;
    for (const satzNr of [1, 2, 3]) {
      expect(await speichereSatz(a, { workoutId, exerciseId: rudern!.id, satzNr, wdh: 12, gewichtKg: 20, technik: "sauber", schmerz: false })).toEqual({
        ok: true,
        daten: null,
      });
    }
    expect((await beendeWorkout(a, workoutId, {})).ok).toBe(true);

    // „Neu laden“: frischer Client, neue Anmeldung als A
    const { data: sitzung } = await (a as ReturnType<typeof createClient>).auth.getSession();
    const a2 = createClient(url!, anonKey!, { db: { schema: "lifestyle" }, auth: { persistSession: false } });
    await a2.auth.setSession({ access_token: sitzung.session!.access_token, refresh_token: sitzung.session!.refresh_token });
    const wieder = await saetzeDesWorkouts(a2 as never, workoutId);
    expect(wieder.ok && wieder.daten.map((s) => [s.exercises?.name, s.set_no, s.reps])).toEqual([
      ["Rudern mit Kurzhantel", 1, 12],
      ["Rudern mit Kurzhantel", 2, 12],
      ["Rudern mit Kurzhantel", 3, 12],
    ]);

    const b = await konto("rudern-b");
    expect(await saetzeDesWorkouts(b, workoutId)).toEqual({ ok: true, daten: [] });
    const direkt = await (b as ReturnType<typeof createClient>).from("workout_sets").select("*").eq("workout_id", workoutId);
    expect(direkt.data).toEqual([]);
    const workouts = await (b as ReturnType<typeof createClient>).from("workouts").select("*").eq("id", workoutId);
    expect(workouts.data).toEqual([]);
    const fremd = await speichereSatz(b, { workoutId, exerciseId: rudern!.id, satzNr: 4, wdh: 1, gewichtKg: 1, technik: "sauber", schmerz: false });
    expect(fremd.ok).toBe(false);
  });
});
