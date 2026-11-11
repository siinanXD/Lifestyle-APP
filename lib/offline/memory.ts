import type { Eintrag, Speicher } from "./queue";

// Speicher im Arbeitsspeicher (SIN-1287): Rückfall, wenn es kein IndexedDB gibt (privates Fenster, Tests). Hält nur bis zum Neuladen.
const gleich = (ist: Eintrag, soll: Eintrag | undefined) => soll === undefined || JSON.stringify(ist) === JSON.stringify(soll);

export function memorySpeicher(): Speicher {
  const eintraege = new Map<string, Eintrag>();
  return {
    alle: async () => [...eintraege.values()],
    hinzufuegen: async (e) => void eintraege.set(e.id, e),
    entfernen: async (id, nurWenn) => {
      const da = eintraege.get(id);
      return da !== undefined && gleich(da, nurWenn) && eintraege.delete(id);
    },
    aktualisieren: async (e, nurWenn) => {
      const da = eintraege.get(e.id);
      if (da === undefined || !gleich(da, nurWenn)) return false;
      eintraege.set(e.id, e);
      return true;
    },
    leeren: async () => eintraege.clear(),
  };
}
