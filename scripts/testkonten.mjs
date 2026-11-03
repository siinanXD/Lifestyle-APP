// SIN-1444: gibt den zwei Testkonten frische Beispieldaten (auch als Reset). Aufruf: `npm run testkonten`.
// Nötig: SUPABASE_URL (oder NEXT_PUBLIC_SUPABASE_URL), SUPABASE_ANON_KEY (oder NEXT_PUBLIC_SUPABASE_ANON_KEY),
// TESTNUTZER_PASSWORT, TESTNUTZER2_PASSWORT (Infisical /leitstand). Kein Service-Key: Das Skript meldet sich
// als Testkonto an, RLS beschränkt es auf dessen eigene Zeilen.
import { createClient } from "@supabase/supabase-js";
import { TESTKONTEN, befuelleTestkonten } from "../lib/testkonten.ts";

const env = process.env;
const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const fehlend = [
  !url && "SUPABASE_URL",
  !key && "SUPABASE_ANON_KEY",
  !env.TESTNUTZER_PASSWORT && "TESTNUTZER_PASSWORT",
  !env.TESTNUTZER2_PASSWORT && "TESTNUTZER2_PASSWORT",
].filter(Boolean);
if (fehlend.length) {
  console.error(`Fehlt: ${fehlend.join(", ")} (nur Namen, Werte aus Infisical /leitstand)`);
  process.exit(1);
}

async function konto(email, password, anlegen) {
  const sb = createClient(url, key, { db: { schema: "lifestyle" }, auth: { persistSession: false, autoRefreshToken: false } });
  let { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error && anlegen) {
    ({ data, error } = await sb.auth.signUp({ email, password }));
    if (!error && !data.session) {
      console.error(`${email} angelegt, aber die E-Mail ist unbestätigt: Sinan muss das Konto bestätigen (Label sinan).`);
      process.exit(2);
    }
  }
  if (error || !data.session) {
    console.error(`Anmeldung für ${email} fehlgeschlagen: ${error?.message ?? "keine Sitzung"}`);
    process.exit(1);
  }
  const userId = data.user.id;
  return {
    userId,
    async exists(table) {
      const { error: e } = await sb.from(table).select("*", { head: true, count: "exact" });
      return !e;
    },
    async list(table) {
      const { data: rows, error: e } = await sb.from(table).select("*");
      if (e) throw e;
      return rows;
    },
    async replace(table, rows) {
      const del = await sb.from(table).delete().eq("user_id", userId);
      if (del.error) throw del.error;
      if (rows.length) {
        const ins = await sb.from(table).insert(rows);
        if (ins.error) throw ins.error;
      }
    },
  };
}

const erstes = await konto(TESTKONTEN.erstes, env.TESTNUTZER_PASSWORT, false);
const zweites = await konto(TESTKONTEN.zweites, env.TESTNUTZER2_PASSWORT, true);
const r = await befuelleTestkonten(erstes, zweites);
console.log(`Gefüllt: ${r.gefuellt.join(", ") || "nichts"}`);
console.log(`Übersprungen (Tabelle fehlt noch): ${r.uebersprungen.join(", ")}`);
console.log(`Zweites Konto sieht fremde Zeilen: ${r.zweitesSiehtFremde}`);
if (r.zweitesSiehtFremde > 0) process.exit(1);
