import type { Eintrag, Speicher } from "./queue";

// Dünne IndexedDB-Fassung des Speichers (SIN-1286), ohne Bibliothek. Keine Logausgabe der Einträge.
const DATENBANK = "lifestyle-offline";
const STORE = "queue";

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
    entfernen: async (id) => void (await transaktion("readwrite", (s) => s.delete(id))),
    aktualisieren: async (eintrag) =>
      void (await transaktion("readwrite", (s) => {
        const vorhanden = s.get(eintrag.id);
        vorhanden.onsuccess = () => vorhanden.result && s.put(eintrag);
        return vorhanden;
      })),
    leeren: async () => void (await transaktion("readwrite", (s) => s.clear())),
  };
}
