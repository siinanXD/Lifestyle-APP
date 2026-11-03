// SIN-1444: Beispieldaten für die zwei Testkonten. Arbeitet nur mit der Sitzung des jeweiligen Kontos (anon-Key + Passwort),
// also unter RLS: Es kann gar keine Zeile eines anderen Kontos erreichen. Zusätzlich lehnt `assertTestkonto` jede andere E-Mail ab.
// Nur Platzhalterdaten, keine echten Gesundheitsdaten (AGENTS.md Regel 6).

export const TESTKONTO_1 = "sinan-test@sjcode.de";
export const TESTKONTO_2 = "sinan-test-2@sjcode.de";
export const TESTKONTEN = [TESTKONTO_1, TESTKONTO_2];

export function assertTestkonto(email: string): void {
  if (!TESTKONTEN.includes(email.toLowerCase())) {
    throw new Error(`Abbruch: ${email} ist kein Testkonto, das Skript fasst nur ${TESTKONTEN.join(" und ")} an.`);
  }
}

type DbError = { code?: string; message: string } | null;

// Schmale Sicht auf den Supabase-Client, damit Tests ohne Datenbank laufen.
export type SeedClient = {
  select(table: string): Promise<{ error: DbError }>;
  deleteAll(table: string, userId: string): Promise<{ error: DbError }>;
  insert(table: string, rows: Record<string, unknown>[]): Promise<{ error: DbError }>;
  upsert(table: string, row: Record<string, unknown>): Promise<{ error: DbError }>;
};

// Tabellen, die es laut Produktumfang geben wird. Gibt es sie (noch) nicht, wird übersprungen und genannt.
export const GEPLANTE_TABELLEN = ["training_plans", "workouts", "meals", "sleep_logs"];

export function istFehlendeTabelle(error: NonNullable<DbError>): boolean {
  return error.code === "PGRST205" || error.code === "42P01" || /could not find the table|does not exist/i.test(error.message);
}

// Sieben Tage Wasserverlauf, deterministisch: gleicher Tag → gleiche Zeilen (Uhrzeiten fest in UTC).
export function wasserZeilen(userId: string, heute: Date): Record<string, unknown>[] {
  const tag = Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), heute.getUTCDate());
  const stunden = [8, 12, 16, 20];
  const mengen = [300, 500, 400, 250];
  const rows: Record<string, unknown>[] = [];
  for (let back = 6; back >= 0; back--) {
    stunden.forEach((h, i) => {
      rows.push({
        user_id: userId,
        amount_ml: mengen[i] + (back % 3) * 50,
        logged_at: new Date(tag - back * 86_400_000 + h * 3_600_000).toISOString(),
      });
    });
  }
  return rows;
}

export type Bericht = { befuellt: string[]; uebersprungen: string[] };

// Setzt das Konto auf den Anfangsstand: eigene Beispielzeilen löschen, neu einfügen. Zweimal ausführen ergibt denselben Stand.
export async function befuellen(
  db: SeedClient,
  konto: { email: string; userId: string },
  heute = new Date(),
): Promise<Bericht> {
  assertTestkonto(konto.email);
  const bericht: Bericht = { befuellt: [], uebersprungen: [] };
  const check = (error: DbError, was: string) => {
    if (error) throw new Error(`${was}: ${error.message}`);
  };

  if (konto.email.toLowerCase() === TESTKONTO_1) {
    check((await db.upsert("profiles", { id: konto.userId, display_name: "Sinan Test" })).error, "profiles");
    bericht.befuellt.push("profiles");
    check((await db.deleteAll("water_logs", konto.userId)).error, "water_logs leeren");
    check((await db.insert("water_logs", wasserZeilen(konto.userId, heute))).error, "water_logs");
    bericht.befuellt.push("water_logs (7 Tage)");
  } else {
    // Zweites Konto bleibt bewusst leer: Es dient der Prüfung „sieht nichts vom ersten“.
    check((await db.upsert("profiles", { id: konto.userId, display_name: "Sinan Test 2" })).error, "profiles");
    check((await db.deleteAll("water_logs", konto.userId)).error, "water_logs leeren");
    bericht.befuellt.push("profiles (Konto 2 sonst leer)");
  }

  for (const tabelle of GEPLANTE_TABELLEN) {
    const { error } = await db.select(tabelle);
    if (error && istFehlendeTabelle(error)) bericht.uebersprungen.push(`${tabelle} (Tabelle existiert noch nicht)`);
    else if (error) throw new Error(`${tabelle}: ${error.message}`);
    else bericht.uebersprungen.push(`${tabelle} (Tabelle vorhanden, Beispieldaten fehlen noch im Skript)`);
  }
  return bericht;
}

export async function leeren(db: SeedClient, konto: { email: string; userId: string }): Promise<void> {
  assertTestkonto(konto.email);
  const { error } = await db.deleteAll("water_logs", konto.userId);
  if (error) throw new Error(`water_logs leeren: ${error.message}`);
}
