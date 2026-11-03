// Beispieldaten für die Testkonten (SIN-1444). Aufruf: npm run testdaten:seed | testdaten:reset
// Env (nur Namen, Werte aus Infisical /leitstand): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
// TESTNUTZER_PASSWORT, TESTNUTZER2_PASSWORT. Das Skript meldet sich als Testkonto an (RLS), kein Service-Key.
import { createClient } from "@supabase/supabase-js";
import { TESTKONTO_1, TESTKONTO_2, seedAccount } from "../lib/testdaten/seed.ts";

const mode = process.argv[2] === "reset" ? "reset" : "seed";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error("NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY fehlen.");
  process.exit(1);
}

const konten = [
  [TESTKONTO_1, process.env.TESTNUTZER_PASSWORT, "TESTNUTZER_PASSWORT"],
  [TESTKONTO_2, process.env.TESTNUTZER2_PASSWORT, "TESTNUTZER2_PASSWORT"],
];
let offen = 0;
for (const [email, password, name] of konten) {
  if (!password) {
    console.log(email + ": übersprungen, " + name + " fehlt.");
    offen++;
    continue;
  }
  const client = createClient(url, anon, { db: { schema: "lifestyle" }, auth: { persistSession: false } });
  let { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error && email === TESTKONTO_2) {
    // Zweites Konto existiert evtl. noch nicht: einmal anlegen. Verlangt das Projekt Bestätigung, braucht es Sinan.
    const up = await client.auth.signUp({ email, password });
    data = up.data;
    if (!data.session) {
      console.log(email + ": angelegt, aber ohne Sitzung (E-Mail-Bestätigung?). Braucht Sinan.");
      offen++;
      continue;
    }
  } else if (error) {
    console.log(email + ": Anmeldung fehlgeschlagen (" + error.message + ").");
    offen++;
    continue;
  }
  const res = await seedAccount(client, { email, userId: data.user.id, mode });
  console.log(
    email + " (" + mode + "): befüllt " + JSON.stringify(res.seeded) + "; übersprungen, Tabelle fehlt noch: " + res.skipped.join(", "),
  );
}
process.exit(offen ? 2 : 0);
