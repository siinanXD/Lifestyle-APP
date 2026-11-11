import { createClient } from "../supabase/client";
import { idbSpeicher } from "./idb-speicher";
import { memorySpeicher } from "./memory";
import { neuerEintrag, verarbeite, type Art, type Eintrag, type Speicher, type Stand } from "./queue";
import { sender } from "./senden";

// Eine Warteschlange je Browser-Tab-Sitzung und ein Durchgang zur Zeit (SIN-1287).
// Formulare schreiben zuerst hierher und zeigen den Eintrag sofort an; gesendet wird danach und bei jeder Gelegenheit erneut.
let speicher: Speicher | undefined;
export const queue = (): Speicher => (speicher ??= typeof indexedDB === "undefined" ? memorySpeicher() : idbSpeicher());
/** Nur für Tests: anderen Speicher einsetzen oder (ohne Argument) zurücksetzen. */
export const setzeQueue = (s?: Speicher) => void (speicher = s);

const hoerer = new Set<(stand: Stand) => void>();
/** Meldet jeden neuen Stand (offen, fehlgeschlagen), z. B. für den Hinweis „wartet auf Verbindung“. */
export function beobachte(fn: (stand: Stand) => void) {
  hoerer.add(fn);
  return () => void hoerer.delete(fn);
}

async function angemeldet(client: ReturnType<typeof createClient>) {
  try {
    return Boolean((await client.auth.getUser()).data.user);
  } catch {
    return false; // offline lässt sich die Sitzung nicht prüfen; dann wird auch nicht gesendet
  }
}

let laeuft: Promise<Stand | null> | undefined;
let nochmal = false;

/**
 * Sendet, was offen ist. Ohne Sitzung geht nichts hinaus (Ergebnis null). Läuft schon ein Durchgang, wird danach genau einer angehängt.
 * `sofort` (Verbindung ist zurück): Wartezeiten nach früheren Fehlversuchen gelten nicht mehr.
 */
export function synchronisiere({ sofort = false }: { sofort?: boolean } = {}): Promise<Stand | null> {
  if (laeuft) {
    nochmal = true;
    return laeuft;
  }
  const lauf = (async (): Promise<Stand | null> => {
    const q = queue();
    const eintraege = await q.alle();
    if (eintraege.length === 0) return { gesendet: 0, offen: 0, fehlgeschlagen: 0 };
    const client = createClient();
    if (!(await angemeldet(client))) return null;
    if (sofort) {
      for (const e of eintraege) {
        if (e.naechsterVersuchAb && !e.fehlgeschlagen) await q.aktualisieren({ ...e, naechsterVersuchAb: undefined }, e);
      }
    }
    return verarbeite(q, sender(client));
  })()
    .catch(() => null)
    .then((stand) => {
      laeuft = undefined;
      if (stand) for (const fn of hoerer) fn(stand);
      if (nochmal) {
        nochmal = false;
        return synchronisiere();
      }
      return stand;
    });
  laeuft = lauf;
  return lauf;
}

/** Legt den Eintrag ab (übersteht Neuladen und Offline-Zeiten) und stößt das Senden an, ohne darauf zu warten. */
export async function reiheEin(art: Art, daten: unknown): Promise<Eintrag> {
  const eintrag = neuerEintrag(art, daten);
  await queue().hinzufuegen(eintrag);
  void synchronisiere();
  return eintrag;
}
