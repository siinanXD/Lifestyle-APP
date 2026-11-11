"use client";

import { useEffect, useState } from "react";
import { beobachte, synchronisiere } from "../lib/offline/sync";

const ALLE_MS = 30_000;

/**
 * Gleicht die Offline-Warteschlange ab (SIN-1287): beim Laden, wenn die Verbindung zurückkommt und alle 30 s, solange etwas offen ist.
 * Zeigt ruhig an, wenn Einträge noch auf dem Gerät warten oder dauerhaft nicht gespeichert werden konnten.
 */
export function SyncProvider() {
  const [stand, setStand] = useState({ offen: 0, fehlgeschlagen: 0 });
  useEffect(() => {
    const ab = beobachte((s) => setStand({ offen: s.offen, fehlgeschlagen: s.fehlgeschlagen }));
    void synchronisiere();
    const online = () => void synchronisiere({ sofort: true });
    window.addEventListener("online", online);
    // Ohne offene Einträge fragt ein Durchgang weder Sitzung noch Server an.
    const takt = setInterval(() => void synchronisiere(), ALLE_MS);
    return () => {
      ab();
      window.removeEventListener("online", online);
      clearInterval(takt);
    };
  }, []);

  if (stand.offen === 0 && stand.fehlgeschlagen === 0) return null;
  return (
    <p role="status" className="sync-hinweis">
      {stand.offen > 0 && `${stand.offen === 1 ? "1 Eintrag wartet" : `${stand.offen} Einträge warten`} auf Verbindung und ${stand.offen === 1 ? "wird" : "werden"} automatisch gesendet. `}
      {stand.fehlgeschlagen > 0 && `${stand.fehlgeschlagen === 1 ? "1 Eintrag konnte" : `${stand.fehlgeschlagen} Einträge konnten`} nicht gespeichert werden.`}
    </p>
  );
}
