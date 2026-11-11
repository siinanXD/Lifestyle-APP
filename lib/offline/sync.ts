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

type Client = ReturnType<typeof createClient>;

/** Vom Auth-Server bestätigte Person; offline oder abgemeldet → undefined, dann wird nicht gesendet. */
async function angemeldet(client: Client): Promise<string | undefined> {
  try {
    return (await client.auth.getUser()).data.user?.id;
  } catch {
    return undefined;
  }
}

/** Person aus der lokalen Sitzung, ohne Netz: damit ein offline erfasster Eintrag weiß, wem er gehört. */
async function lokaleNutzerId(client: Client): Promise<string | undefined> {
  try {
    const { data } = (await client.auth.getSession()) as { data: { session?: { user?: { id?: string } } | null; user?: { id?: string } | null } };
    return data.session?.user?.id ?? data.user?.id;
  } catch {
    return undefined;
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
    const nutzer = await angemeldet(client);
    if (!nutzer) return null;
    // Einträge eines anderen Kontos auf diesem Gerät (abgemeldet, bevor gesendet wurde) gehen nie unter dem jetzigen Konto hinaus.
    for (const e of eintraege) if (e.nutzer && e.nutzer !== nutzer) await q.entfernen(e.id);
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
  const nutzer = await lokaleNutzerId(createClient());
  const eintrag = { ...neuerEintrag(art, daten), ...(nutzer && { nutzer }) };
  await queue().hinzufuegen(eintrag);
  void synchronisiere();
  return eintrag;
}
