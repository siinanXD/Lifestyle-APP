"use client";

import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { bewerteComeback, type Befinden, type Comeback } from "../../../lib/training/comeback";
import { aenderungText, BEFINDEN, GRUENDE, merkeComeback, speichereCheckin, TEXTE, type Grund } from "../../../lib/training/comeback-ablauf";

/** Erscheint auf /training nach einer Pause ab 14 Tagen (SIN-1281). Beide Fragen sind freiwillig, „Überspringen“ ist gleich groß. */
export function ComebackKarte({ tage }: { tage: number }) {
  const [grund, setGrund] = useState<Grund>();
  const [befinden, setBefinden] = useState<Befinden>();
  const [ergebnis, setErgebnis] = useState<{ comeback: Comeback; grund?: Grund }>();
  const [fehler, setFehler] = useState("");
  const [busy, setBusy] = useState(false);

  async function fertig(mitAngaben: boolean) {
    const comeback = bewerteComeback(tage, mitAngaben ? befinden : undefined);
    if (mitAngaben && (grund || befinden)) {
      setBusy(true);
      const r = await speichereCheckin(createClient(), { tage, grund, befinden, stufe: comeback.stufe });
      setBusy(false);
      // Die Anpassung gilt auch, wenn das Speichern klemmt: Der sanfte Einstieg hängt nicht an der Datenbank.
      if (!r.ok) setFehler("Deine Angabe ließ sich gerade nicht speichern. Der sanfte Einstieg gilt trotzdem.");
    }
    merkeComeback({ tage, befinden: mitAngaben ? befinden : undefined });
    setErgebnis({ comeback, grund: mitAngaben ? grund : undefined });
  }

  if (ergebnis) {
    return (
      <section className="card stack" aria-label="Wiedereinstieg">
        <h2>{TEXTE.titel}</h2>
        <p>{aenderungText(ergebnis.comeback)}</p>
        {ergebnis.grund === "krank_oder_verletzt" && <p className="muted">{TEXTE.aerztlich}</p>}
        {fehler && (
          <p role="alert" className="error">
            {fehler}
          </p>
        )}
      </section>
    );
  }

  const auswahl = <K extends string>(titel: string, optionen: Record<K, string>, wert: K | undefined, setze: (k: K | undefined) => void) => (
    <div className="stack" role="group" aria-label={titel}>
      <p>{titel}</p>
      <div className="chips">
        {(Object.entries(optionen) as [K, string][]).map(([k, text]) => (
          <button key={k} type="button" className="chip" aria-pressed={wert === k} disabled={busy} onClick={() => setze(wert === k ? undefined : k)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <section className="card stack" aria-label="Wiedereinstieg">
      <h2>{TEXTE.titel}</h2>
      <p className="muted">{TEXTE.einleitung}</p>
      {auswahl(TEXTE.grund, GRUENDE, grund, setGrund)}
      {auswahl(TEXTE.befinden, BEFINDEN, befinden, setBefinden)}
      <div className="actions">
        <button type="button" className="btn" disabled={busy} onClick={() => fertig(true)}>
          Weiter
        </button>
        <button type="button" className="btn" data-variant="neutral" disabled={busy} onClick={() => fertig(false)}>
          Überspringen
        </button>
      </div>
    </section>
  );
}
