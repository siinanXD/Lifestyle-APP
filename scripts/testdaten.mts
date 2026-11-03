// SIN-1444: Beispieldaten für die Testkonten. Aufruf: npm run testdaten | testdaten:leeren | testdaten:pruefen | testdaten:konto2
// Benötigt NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, TESTNUTZER_PASSWORT, TESTNUTZER2_PASSWORT (Werte aus Infisical /leitstand).
import { createClient } from "@supabase/supabase-js";
import { befuellen, leeren, TESTKONTO_1, TESTKONTO_2, assertTestkonto, type SeedClient } from "../lib/testdaten/seed.ts";

const env = (name: string) => {
  const v = process.env[name];
  if (!v) throw new Error(`Umgebungsvariable ${name} fehlt (Wert aus Infisical /leitstand, nie ins Repo).`);
  return v;
};

function neuerClient() {
  return createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "lifestyle" },
  });
}

async function anmelden(email: string, passwortVar: string) {
  assertTestkonto(email);
  const sb = neuerClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password: env(passwortVar) });
  if (error || !data.user) throw new Error(`Anmeldung ${email} fehlgeschlagen: ${error?.message ?? "kein Nutzer"}`);
  return { sb, userId: data.user.id };
}

function adapter(sb: ReturnType<typeof neuerClient>): SeedClient {
  return {
    select: async (t) => ({ error: (await sb.from(t).select("*").limit(1)).error }),
    deleteAll: async (t, userId) => ({ error: (await sb.from(t).delete().eq("user_id", userId)).error }),
    insert: async (t, rows) => ({ error: (await sb.from(t).insert(rows)).error }),
    upsert: async (t, row) => ({ error: (await sb.from(t).upsert(row)).error }),
  };
}

const konten = [
  { email: TESTKONTO_1, pw: "TESTNUTZER_PASSWORT" },
  { email: TESTKONTO_2, pw: "TESTNUTZER2_PASSWORT" },
];

const befehl = process.argv[2] ?? "befuellen";

if (befehl === "befuellen" || befehl === "leeren") {
  for (const k of konten) {
    const { sb, userId } = await anmelden(k.email, k.pw);
    if (befehl === "leeren") {
      await leeren(adapter(sb), { email: k.email, userId });
      console.log(`${k.email}: geleert`);
      continue;
    }
    const b = await befuellen(adapter(sb), { email: k.email, userId });
    console.log(`${k.email}\n  befüllt: ${b.befuellt.join(", ")}\n  übersprungen: ${b.uebersprungen.join("; ")}`);
  }
} else if (befehl === "pruefen") {
  const { sb } = await anmelden(TESTKONTO_2, "TESTNUTZER2_PASSWORT");
  const wasser = await sb.from("water_logs").select("id");
  const profile = await sb.from("profiles").select("id");
  const fehler = wasser.error ?? profile.error;
  if (fehler) throw new Error(fehler.message);
  const nWasser = wasser.data?.length ?? 0;
  const nProfile = profile.data?.length ?? 0;
  console.log(`Konto 2 sieht water_logs: ${nWasser}, profiles: ${nProfile} (Soll: 0 und 1)`);
  if (nWasser !== 0 || nProfile !== 1) process.exit(1);
  console.log("OK: Konto 2 sieht nichts vom ersten Konto.");
} else if (befehl === "konto2") {
  // Legt Konto 2 per Registrierung an. Verlangt das gemeinsame Projekt E-Mail-Bestätigung, bleibt das Konto unbestätigt (dann Zugang nötig).
  const { data, error } = await neuerClient().auth.signUp({ email: TESTKONTO_2, password: env("TESTNUTZER2_PASSWORT") });
  if (error) throw new Error(`Registrierung fehlgeschlagen: ${error.message}`);
  console.log(data.session ? "Konto 2 angelegt und angemeldet." : "Konto 2 angelegt oder vorhanden, aber ohne Sitzung (E-Mail-Bestätigung offen).");
} else {
  throw new Error(`Unbekannter Befehl ${befehl}. Erlaubt: befuellen, leeren, pruefen, konto2`);
}
