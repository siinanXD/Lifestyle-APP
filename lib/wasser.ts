// Wasserübersicht für die Startseite (SIN-1444). Ein Glas = 250 ml, Ziel 8 Gläser (Figma „08 Startseite“).
export interface WasserZeile {
  amount_ml: number;
  logged_at: string;
}

export const GLAS_ML = 250;
export const ZIEL_GLAESER = 8;

// Tage zählen nach Berliner Zeit, nicht nach Serverzeit (Vercel läuft in UTC).
const tagBerlin = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

export const glaeser = (ml: number) => Math.floor(ml / GLAS_ML);

/** Sieben Tage bis einschließlich heute, ältester zuerst; Tage ohne Eintrag zählen 0. */
export function wasserProTag(rows: WasserZeile[], jetzt: Date): { tag: string; ml: number }[] {
  const summen = new Map<string, number>();
  for (const r of rows) {
    const tag = tagBerlin(new Date(r.logged_at));
    summen.set(tag, (summen.get(tag) ?? 0) + r.amount_ml);
  }
  const tage: { tag: string; ml: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    // 12:00 UTC minus i Tage fällt in Berlin nie über eine Tagesgrenze.
    const mittag = Date.UTC(jetzt.getUTCFullYear(), jetzt.getUTCMonth(), jetzt.getUTCDate() - i, 12);
    const tag = tagBerlin(new Date(mittag));
    tage.push({ tag, ml: summen.get(tag) ?? 0 });
  }
  return tage;
}
