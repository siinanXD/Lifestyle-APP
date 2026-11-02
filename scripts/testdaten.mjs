// SIN-1444: Beispieldaten für die beiden Testkonten. Läuft als der Nutzer selbst (Anon-Key + Passwort),
// RLS begrenzt jeden Schreibzugriff auf dessen eigene Zeilen. Kein Service-Key, nur Platzhalterdaten.
// Aufruf: node scripts/testdaten.mjs [seed|reset] [1|2|alle]
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

export const KONTEN = {
  1: { email: "sinan-test@sjcode.de", passwortEnv: "TESTNUTZER_PASSWORT", name: "Sinan Test" },
  2: { email: "sinan-test-2@sjcode.de", passwortEnv: "TESTNUTZER2_PASSWORT", name: "Sinan Test 2" },
};
export const ERLAUBTE_EMAILS = Object.values(KONTEN).map((k) => k.email);

// Tabellen mit Seed. Neue Tabellen hier ergänzen (und in lifestyle.delete_own_data).
const WASSER_ML = [500, 250, 300, 400, 250, 300];
export function wasserZeilen(userId, heute = new Date()) {
  const tag0 = Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), heute.getUTCDate());
  const rows = [];
  for (let tag = 0; tag < 7; tag++) {
    WASSER_ML.slice(0, 3 + ((tag * 2) % 4)).forEach((amount_ml, i) => {
      rows.push({ user_id: userId, amount_ml, logged_at: new Date(tag0 - tag * 864e5 + (8 + i * 3) * 36e5).toISOString() });
    });
  }
  return rows;
}
export const SEEDS = [{ tabelle: "water_logs", zeilen: wasserZeilen }];
// Noch nicht gebaut; wird geprüft und genannt, sobald es die Tabelle gibt, aber noch kein Seed.
export const AUSSTEHEND = { Plan: "training_plans", Trainings: "workouts", Essen: "meals", Schlaf: "sleep_logs" };

const fehlt = (e) => e && (e.code === "PGRST205" || e.code === "42P01");

export async function seedKonto(db, userId, name, { heute = new Date(), nurLoeschen = false } = {}) {
  const bericht = { befuellt: [], uebersprungen: [] };
  const p = await db.from("profiles").upsert({ id: userId, display_name: name });
  if (p.error) throw p.error;
  for (const { tabelle, zeilen } of SEEDS) {
    const del = await db.from(tabelle).delete().eq("user_id", userId);
    if (fehlt(del.error)) {
      bericht.uebersprungen.push(tabelle);
      continue;
    }
    if (del.error) throw del.error;
    if (nurLoeschen) continue;
    const rows = zeilen(userId, heute);
    const ins = await db.from(tabelle).insert(rows);
    if (ins.error) throw ins.error;
    bericht.befuellt.push(tabelle + " (" + rows.length + ")");
  }
  for (const [label, tabelle] of Object.entries(AUSSTEHEND)) {
    const r = await db.from(tabelle).select("*", { head: true, count: "exact" });
    bericht.uebersprungen.push(label + (fehlt(r.error) ? " (Tabelle fehlt)" : " (noch kein Seed)"));
  }
  return bericht;
}

async function anmelden(url, key, nr) {
  const konto = KONTEN[nr];
  const passwort = process.env[konto.passwortEnv];
  if (!passwort) throw new Error(konto.passwortEnv + " fehlt (Infisical /leitstand).");
  const client = createClient(url, key, { db: { schema: "lifestyle" }, auth: { persistSession: false } });
  let { data, error } = await client.auth.signInWithPassword({ email: konto.email, password: passwort });
  if (error && nr === 2) {
    // Zweites Konto beim ersten Lauf anlegen; scheitert das (z. B. Mailbestätigung), Label `sinan` setzen.
    const su = await client.auth.signUp({ email: konto.email, password: passwort });
    if (su.error) throw new Error("Konto " + konto.email + " nicht anlegbar: " + su.error.message);
    ({ data, error } = await client.auth.signInWithPassword({ email: konto.email, password: passwort }));
  }
  if (error) throw new Error("Anmeldung " + konto.email + ": " + error.message);
  return { client, userId: data.user.id, konto };
}

async function main() {
  const [modus = "seed", welche = "alle"] = process.argv.slice(2);
  if (!["seed", "reset"].includes(modus)) throw new Error("Modus: seed | reset");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY fehlen.");
  for (const nr of welche === "alle" ? [1, 2] : [Number(welche)]) {
    if (!KONTEN[nr]) throw new Error("Konto: 1 | 2 | alle");
    const { client, userId, konto } = await anmelden(url, key, nr);
    if (!ERLAUBTE_EMAILS.includes(konto.email)) throw new Error("Nur Testkonten erlaubt.");
    // Konto 2 bleibt absichtlich leer: Es dient der Prüfung „sieht nichts vom ersten“.
    const b = await seedKonto(client, userId, konto.name, { nurLoeschen: nr === 2 });
    console.log(konto.email + ": befüllt " + (b.befuellt.join(", ") || "-") + "; übersprungen " + (b.uebersprungen.join(", ") || "-"));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
