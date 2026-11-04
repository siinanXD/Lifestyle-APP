// Beispieldaten für die zwei Testkonten (SIN-1444). Nur Platzhalterdaten, keine echten Gesundheitsdaten.
// Das Skript meldet sich als Testkonto an und läuft damit unter RLS: fremde Zeilen sind unerreichbar.

export const TESTKONTO_1 = "sinan-test@sjcode.de";
export const TESTKONTO_2 = "sinan-test-2@sjcode.de";
export const ERLAUBTE_KONTEN: readonly string[] = [TESTKONTO_1, TESTKONTO_2];

type DbError = { code?: string; message: string } | null;
type Result = PromiseLike<{ error: DbError }>;

/** Schmale Sicht auf den Supabase-Client, damit der Test eine Attrappe einsetzen kann. */
export interface SeedClient {
  from(table: string): {
    delete(): { eq(col: string, v: string): Result; in(col: string, v: string[]): Result };
    insert(rows: Record<string, unknown>[]): Result;
  };
}

export interface SeedTable {
  table: string;
  /** Spalte, über die Beispielzeilen wiedererkannt werden. */
  key: string;
  rows(userId: string, today: Date): Record<string, unknown>[];
}

// Nur „Relation fehlt“ (Postgres 42P01, PostgREST PGRST205) heißt „noch keine Tabelle“; jeder andere Fehler bricht ab.
const MISSING_TABLE = new Set(["42P01", "PGRST205"]);
const isMissing = (e: DbError) => !!e && MISSING_TABLE.has(e.code ?? "");

// Sieben Tage Wasserverlauf mit festen Uhrzeiten: zwei Läufe am selben Tag ergeben dieselben Zeilen.
const WASSER_ML = [250, 400, 300, 500, 350, 250];
const WASSER_STUNDEN = [8, 10, 12, 15, 18, 20];

export const TABELLEN: SeedTable[] = [
  {
    table: "water_logs",
    key: "logged_at",
    rows(userId, today) {
      const rows: Record<string, unknown>[] = [];
      for (let tag = 6; tag >= 0; tag--) {
        WASSER_STUNDEN.forEach((h, i) => {
          const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - tag, h));
          rows.push({ user_id: userId, amount_ml: WASSER_ML[(i + tag) % WASSER_ML.length], logged_at: d.toISOString() });
        });
      }
      return rows;
    },
  },
  // Plan, Trainings, Essen, Schlaf: Tabellen gibt es noch nicht. Sobald sie existieren, hier eintragen.
];

/** Laut Auftrag zu befüllen, aber es gibt noch keine Tabelle. */
export const NOCH_OHNE_TABELLE = ["Plan", "Trainings", "Essen", "Schlaf"];

export interface SeedResult {
  seeded: Record<string, number>;
  skipped: string[];
}

export async function seedAccount(
  client: SeedClient,
  opts: { email: string; userId: string; mode: "seed" | "reset"; today?: Date },
): Promise<SeedResult> {
  if (!ERLAUBTE_KONTEN.includes(opts.email)) {
    throw new Error("Konto " + opts.email + " ist kein Testkonto, Abbruch.");
  }
  const today = opts.today ?? new Date();
  const result: SeedResult = { seeded: {}, skipped: [...NOCH_OHNE_TABELLE] };
  const leer = opts.email === TESTKONTO_2; // bleibt leer: beweist, dass es nichts vom ersten sieht

  for (const t of TABELLEN) {
    const rows = t.rows(opts.userId, today);
    if (leer && opts.mode === "seed") continue;
    const del =
      opts.mode === "reset"
        ? await client.from(t.table).delete().eq("user_id", opts.userId)
        : await client.from(t.table).delete().in(t.key, rows.map((r) => String(r[t.key])));
    if (isMissing(del.error)) {
      result.skipped.push(t.table);
      continue;
    }
    if (del.error) throw new Error(t.table + ": " + del.error.message);
    if (leer) continue;
    const ins = await client.from(t.table).insert(rows);
    if (ins.error) throw new Error(t.table + ": " + ins.error.message);
    result.seeded[t.table] = rows.length;
  }
  return result;
}

type AuthError = { code?: string; message: string } | null;
type AuthResult = Promise<{ data: { user: { id: string } | null; session: unknown | null }; error: AuthError }>;

/** Schmale Sicht auf `client.auth`. */
export interface AuthClient {
  signInWithPassword(c: { email: string; password: string }): AuthResult;
  signUp(c: { email: string; password: string }): AuthResult;
}

/**
 * Meldet das Testkonto an. Nur Konto 2 wird bei falschen Zugangsdaten (`invalid_credentials`) neu angelegt;
 * jeder andere Fehler, etwa Netzwerk oder Rate-Limit, bricht ab. Ohne Sitzung nach signUp wirft die Funktion:
 * entweder verlangt das Projekt E-Mail-Bestätigung oder das Konto existiert mit anderem Passwort.
 */
export async function anmelden(auth: AuthClient, email: string, password: string): Promise<string> {
  const login = await auth.signInWithPassword({ email, password });
  if (!login.error && login.data.user) return login.data.user.id;
  if (email !== TESTKONTO_2 || login.error?.code !== "invalid_credentials") {
    throw new Error("Anmeldung fehlgeschlagen (" + (login.error?.message ?? "keine Sitzung") + ").");
  }
  const up = await auth.signUp({ email, password });
  if (up.error) throw new Error("Anlegen fehlgeschlagen (" + up.error.message + ").");
  if (!up.data.session || !up.data.user) {
    throw new Error(
      "Konto existiert mit anderem Passwort oder braucht E-Mail-Bestätigung. Sinan prüft TESTNUTZER2_PASSWORT und das Konto.",
    );
  }
  return up.data.user.id;
}
