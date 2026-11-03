// SIN-1444: Beispieldaten für die zwei Testkonten, damit man die App ohne Eintippen durchklicken kann.
// Aufruf: npm run testdaten   (Beispieldaten setzen)   |   npm run testdaten:reset   (Anfangsstand wiederherstellen)
// Umgebung (nur Namen, Werte aus Infisical /leitstand): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
// TESTNUTZER_PASSWORT, TESTNUTZER2_PASSWORT.
// Sicherheit: Das Skript meldet sich als das jeweilige Testkonto an und arbeitet nur mit dessen Sitzung (RLS);
// fremde Konten sind schon dadurch unerreichbar. Zusätzlich lehnt es jede andere E-Mail-Adresse ab.
// Nur Platzhalterdaten, keine echten Gesundheitsdaten (AGENTS.md Regel 6).
import { pathToFileURL } from "node:url";

export const KONTO_1 = "sinan-test@sjcode.de";
export const KONTO_2 = "sinan-test-2@sjcode.de";
export const ERLAUBTE_KONTEN = [KONTO_1, KONTO_2];

// Tabellen der Produktplanung, die es noch nicht gibt, werden übersprungen und genannt (PostgREST: 404 / PGRST205).
const GEPLANT = ["training_plans", "workouts", "meals", "sleep_logs"];
const TAG_MS = 24 * 60 * 60 * 1000;
const STUNDE_MS = 60 * 60 * 1000;

// Deterministisch pro Kalendertag (UTC), damit ein zweiter Lauf denselben Stand ergibt.
export function wasserEintraege(konto, userId, jetzt = new Date()) {
  const heute = Date.UTC(jetzt.getUTCFullYear(), jetzt.getUTCMonth(), jetzt.getUTCDate());
  if (konto === KONTO_2) {
    // Bewusst anders und klein: das zweite Konto darf nichts vom ersten sehen.
    return [{ user_id: userId, amount_ml: 100, logged_at: new Date(heute + 10.5 * STUNDE_MS).toISOString() }];
  }
  const rows = [];
  for (let tag = 0; tag < 7; tag++) {
    for (const [stunde, ml] of [[8, 250], [12, 500], [16, 300], [19, 400]]) {
      rows.push({
        user_id: userId,
        amount_ml: ml + tag * 10,
        logged_at: new Date(heute - tag * TAG_MS + stunde * STUNDE_MS).toISOString(),
      });
    }
  }
  return rows;
}

function rest(ctx, token, method, pfad, body) {
  return ctx.fetch(`${ctx.url}/rest/v1/${pfad}`, {
    method,
    headers: {
      apikey: ctx.anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      [method === "GET" ? "Accept-Profile" : "Content-Profile"]: "lifestyle",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function anmelden(ctx, email, passwort) {
  const headers = { apikey: ctx.anonKey, "Content-Type": "application/json" };
  const body = JSON.stringify({ email, password: passwort });
  let res = await ctx.fetch(`${ctx.url}/auth/v1/token?grant_type=password`, { method: "POST", headers, body });
  if (res.ok) return await res.json();
  if (email !== KONTO_2) throw new Error(`Anmeldung für ${email} fehlgeschlagen (${res.status}); das Konto muss existieren.`);
  // Zweites Konto beim ersten Lauf anlegen.
  res = await ctx.fetch(`${ctx.url}/auth/v1/signup`, { method: "POST", headers, body });
  const daten = res.ok ? await res.json() : null;
  if (!daten?.access_token) {
    throw new Error(
      `Konto ${email} konnte nicht angelegt werden (${res.status}); vermutlich fehlt ein Zugang oder eine E-Mail-Bestätigung. Sinan muss es anlegen.`,
    );
  }
  return daten;
}

async function setzeKonto(ctx, email, passwort, modus) {
  const bericht = [];
  const sitzung = await anmelden(ctx, email, passwort);
  const token = sitzung.access_token;
  const userId = sitzung.user.id;

  // Tabellen, die es (noch) nicht gibt, überspringen und nennen.
  for (const tabelle of GEPLANT) {
    const res = await rest(ctx, token, "GET", `${tabelle}?select=*&limit=0`);
    bericht.push(
      res.status === 404 ? `${tabelle}: übersprungen (Tabelle fehlt noch)` : `${tabelle}: Tabelle vorhanden, aber noch kein Seeder`,
    );
  }

  const profil = await rest(ctx, token, "POST", "profiles?on_conflict=id", {
    id: userId,
    display_name: email === KONTO_1 ? "Testkonto 1" : "Testkonto 2",
  });
  if (!profil.ok) throw new Error(`profiles: ${profil.status}`);

  const del = await rest(ctx, token, "DELETE", `water_logs?user_id=eq.${userId}`);
  if (!del.ok) throw new Error(`water_logs löschen: ${del.status}`);
  const rows = wasserEintraege(email, userId, ctx.jetzt);
  const ins = await rest(ctx, token, "POST", "water_logs", rows);
  if (!ins.ok) throw new Error(`water_logs anlegen: ${ins.status}`);
  bericht.push(`water_logs: ${rows.length} Einträge ${modus === "reset" ? "zurückgesetzt" : "gesetzt"}`);
  return bericht;
}

export async function run({ env = process.env, fetch: f = globalThis.fetch, jetzt = new Date(), modus = "seed", log = console.log } = {}) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY fehlen (siehe .env.example).");
  const ctx = { url, anonKey, fetch: f, jetzt };
  const konten = [
    [env.TESTNUTZER_EMAIL ?? KONTO_1, env.TESTNUTZER_PASSWORT],
    [KONTO_2, env.TESTNUTZER2_PASSWORT],
  ];
  // Erst alle Adressen prüfen, dann etwas anfassen.
  for (const [email] of konten) {
    if (!ERLAUBTE_KONTEN.includes(email)) throw new Error(`Abgelehnt: ${email} ist kein Testkonto.`);
  }
  const ergebnis = {};
  for (const [email, passwort] of konten) {
    if (!passwort) {
      log(`${email}: übersprungen (Passwort nicht gesetzt)`);
      continue;
    }
    ergebnis[email] = await setzeKonto(ctx, email, passwort, modus);
    for (const zeile of ergebnis[email]) log(`${email}: ${zeile}`);
  }
  return ergebnis;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run({ modus: process.argv[2] === "reset" ? "reset" : "seed" }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
