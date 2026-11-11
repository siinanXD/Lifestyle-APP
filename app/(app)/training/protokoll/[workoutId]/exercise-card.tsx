"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../../../lib/supabase/client";
import { gemerktesComeback } from "../../../../../lib/training/comeback-ablauf";
import { muskelText } from "../../../../../lib/training/katalog";
import type { Ziel } from "../../../../../lib/training/progression";
import { baueKarte, empfehlungText, gewichtText, ladeFruehereSaetze, OHNE_VERLAUF, type Karte } from "../../../../../lib/training/uebungskarte";

type Uebung = { id: string; name: string; muscle_groups?: string[]; technique?: string };
const datum = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" });

/**
 * Übungskarte im Training (SIN-1276): zuletzt und Empfehlung heute, ausdrücklich als Vorschlag.
 * Das Gewichtsfeld ändert sich nur durch einen Tipp auf „Übernehmen“. Die Animation (ExerciseLoop) folgt mit SIN-1269.
 */
export function ExerciseCard({
  uebung,
  workoutId,
  ziel,
  stufeKg,
  onUebernehmen,
}: {
  uebung: Uebung;
  workoutId: string;
  ziel: Ziel;
  stufeKg: number;
  onUebernehmen: (gewichtKg: number) => void;
}) {
  // undefined = lädt, null = Lesefehler (dann zeigt die Karte nur die Übung, das Training geht weiter)
  const [karte, setKarte] = useState<{ fuer: string; karte: Karte | null }>();
  const { wdhMin, wdhMax } = ziel;
  useEffect(() => {
    let aktuell = true;
    ladeFruehereSaetze(createClient(), uebung.id, workoutId).then((r) => {
      if (!aktuell) return;
      let neu: Karte | null = null;
      try {
        // Läuft eine Rückkehr nach Pause (SIN-1281), zählt der sanfte Einstieg statt der Progression.
        if (r.ok) neu = baueKarte(r.daten ?? [], { wdhMin, wdhMax }, stufeKg, gemerktesComeback());
      } catch {
        neu = null; // unbrauchbare Altdaten sollen das Training nicht blockieren
      }
      setKarte({ fuer: uebung.id, karte: neu });
    });
    return () => {
      aktuell = false;
    };
  }, [uebung.id, workoutId, wdhMin, wdhMax, stufeKg]);

  const bereit = karte?.fuer === uebung.id ? karte.karte : undefined;
  const text = bereit?.empfehlung ? empfehlungText(bereit.empfehlung) : null;
  const zielgewicht = bereit?.empfehlung?.zielgewichtKg ?? null;

  return (
    <section className="card stack" aria-label="Übungskarte">
      <h2>{uebung.name}</h2>
      {uebung.muscle_groups && uebung.muscle_groups.length > 0 && <p className="muted">{uebung.muscle_groups.map(muskelText).join(", ")}</p>}
      {uebung.technique && <p>{uebung.technique}</p>}
      {bereit === undefined ? (
        <p className="muted" aria-busy="true">
          Lädt …
        </p>
      ) : bereit === null ? null : bereit.zuletzt.length === 0 ? (
        <p className="muted">{OHNE_VERLAUF}</p>
      ) : (
        <>
          <h3>Zuletzt</h3>
          <ul className="summary" aria-label="Zuletzt">
            {bereit.zuletzt.map((r) => (
              <li key={r.workoutId}>
                {datum(r.datum)}: {gewichtText(r.gewichtKg)} · {r.wiederholungen.join(", ")} Wdh
              </li>
            ))}
          </ul>
          {text && (
            <>
              <h3>Empfehlung heute: {text.titel}</h3>
              {text.vorschlag && <p>{text.vorschlag}</p>}
              <p className="muted">{text.erklaerung}</p>
              {zielgewicht !== null && zielgewicht > 0 && (
                <button type="button" className="btn" data-variant="neutral" onClick={() => onUebernehmen(zielgewicht)}>
                  Übernehmen
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
