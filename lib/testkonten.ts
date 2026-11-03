// SIN-1444: Beispieldaten für die zwei Testkonten. Nur Platzhalterdaten, keine echten Gesundheitsdaten.
// Das Skript meldet sich als das jeweilige Konto an; RLS lässt es nur dessen eigene Zeilen anfassen.

export const TESTKONTEN = {
  erstes: "sinan-test@sjcode.de",
  zweites: "sinan-test-2@sjcode.de",
} as const;

export const UEBERSPRUNGEN = ["Plan", "Trainings", "Essen", "Schlaf"] as const;

export type Row = Record<string, unknown>;

export type KontoDb = {
  userId: string;
  // Gibt es die Tabelle im Schema lifestyle schon?
  exists(table: string): Promise<boolean>;
  // Alle für dieses Konto sichtbaren Zeilen.
  list(table: string): Promise<Row[]>;
  // Löscht die eigenen Zeilen und legt rows neu an.
  replace(table: string, rows: Row[]): Promise<void>;
};

// Sieben Tage Verlauf bis einschließlich heute (UTC), je drei Einträge. Gleicher Tag gleicher Stand.
export function waterRows(userId: string, now: Date): Row[] {
  const day = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const rows: Row[] = [];
  for (let back = 6; back >= 0; back--) {
    [
      [8, 300],
      [13, 500 + (back % 3) * 100],
      [18, 400],
    ].forEach(([hour, amount]) => {
      rows.push({
        user_id: userId,
        amount_ml: amount,
        logged_at: new Date(day - back * 86_400_000 + hour * 3_600_000).toISOString(),
      });
    });
  }
  return rows;
}

export type Ergebnis = { gefuellt: string[]; uebersprungen: string[]; zweitesSiehtFremde: number };

export async function befuelleTestkonten(erstes: KontoDb, zweites: KontoDb, now = new Date()): Promise<Ergebnis> {
  const gefuellt: string[] = [];
  const uebersprungen: string[] = [...UEBERSPRUNGEN];
  if (await erstes.exists("water_logs")) {
    await erstes.replace("water_logs", waterRows(erstes.userId, now));
    // Das zweite Konto startet leer.
    await zweites.replace("water_logs", []);
    gefuellt.push("Wasser (7 Tage)");
  } else {
    uebersprungen.push("Wasser");
  }
  // Beleg „sieht nichts vom ersten“: jede für das zweite Konto sichtbare Zeile muss ihm selbst gehören.
  const sichtbar = await zweites.exists("water_logs") ? await zweites.list("water_logs") : [];
  const zweitesSiehtFremde = sichtbar.filter((r) => r.user_id !== zweites.userId).length;
  return { gefuellt, uebersprungen, zweitesSiehtFremde };
}
