import type { Eintrag, Speicher } from "./queue";

// Dünne IndexedDB-Fassung des Speichers (SIN-1286), ohne Bibliothek. Keine Logausgabe der Einträge.
const DATENBANK = "lifestyle-offline";
const STORE = "queue";

const gleich = (ist: Eintrag, soll: Eintrag | undefined) => soll === undefined || JSON.stringify(ist) === JSON.stringify(soll);

export function idbSpeicher(idb: IDBFactory = indexedDB): Speicher {
  let offen: Promise<IDBDatabase> | undefined;
  const datenbank = () =>
    (offen ??= new Promise<IDBDatabase>((ok, fehler) => {
      const anfrage = idb.open(DATENBANK, 1);
      anfrage.onupgradeneeded = () => anfrage.result.createObjectStore(STORE, { keyPath: "id" });
      anfrage.onsuccess = () => ok(anfrage.result);
      anfrage.onerror = () => {
        offen = undefined; // nächster Aufruf versucht es erneut
        fehler(anfrage.error);
      };
    }));

  // Fertig ist erst, wenn die Transaktion abgeschlossen ist; sonst gälte ein abgebrochener Schreibvorgang als gespeichert.
  async function transaktion<T>(modus: IDBTransactionMode, aktion: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const tx = (await datenbank()).transaction(STORE, modus);
    const anfrage = aktion(tx.objectStore(STORE));
    return new Promise<T>((ok, fehler) => {
      tx.oncomplete = () => ok(anfrage.result);
      tx.onerror = tx.onabort = () => fehler(tx.error);
    });
  }

  return {
    alle: () => transaktion<Eintrag[]>("readonly", (s) => s.getAll()),
    hinzufuegen: async (eintrag) => void (await transaktion("readwrite", (s) => s.put(eintrag))),
    // Lesen, vergleichen und schreiben in EINER Transaktion: ein Ersatz dazwischen ist ausgeschlossen.
    entfernen: async (id, nurWenn) => {
      let entfernt = false;
      await transaktion("readwrite", (s) => {
        const vorhanden = s.get(id);
        vorhanden.onsuccess = () => {
          entfernt = vorhanden.result !== undefined && gleich(vorhanden.result, nurWenn);
          if (entfernt) s.delete(id);
        };
        return vorhanden;
      });
      return entfernt;
    },
    aktualisieren: async (eintrag, nurWenn) => {
      let geschrieben = false;
      await transaktion("readwrite", (s) => {
        const vorhanden = s.get(eintrag.id);
        vorhanden.onsuccess = () => {
          geschrieben = vorhanden.result !== undefined && gleich(vorhanden.result, nurWenn);
          if (geschrieben) s.put(eintrag);
        };
        return vorhanden;
      });
      return geschrieben;
    },
    leeren: async () => void (await transaktion("readwrite", (s) => s.clear())),
  };
}
