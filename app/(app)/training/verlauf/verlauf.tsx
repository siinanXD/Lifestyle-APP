"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "../../../../lib/supabase/client";
import { gruppiere, ladeVerlauf, loescheEintrag, type Eintrag } from "../../../../lib/training/verlauf";

const FEHLER = "Das hat gerade nicht geklappt. Bitte versuch es gleich noch einmal.";
const zeit = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const km = (wert: number) => `${Number(wert).toLocaleString("de-DE")} km`;

export function Verlauf({ start }: { start: { eintraege: Eintrag[]; weiter: string | null } }) {
  const [eintraege, setEintraege] = useState(start.eintraege);
  const [weiter, setWeiter] = useState(start.weiter);
  const [frage, setFrage] = useState<string | null>(null); // id des Eintrags mit offener Rückfrage
  const [fehler, setFehler] = useState("");
  const [busy, setBusy] = useState(false);

  async function mehr() {
    if (!weiter) return;
    setBusy(true);
    const r = await ladeVerlauf(createClient(), { vor: weiter });
    setBusy(false);
    if (!r.ok) return setFehler(FEHLER);
    setFehler("");
    setEintraege((alt) => [...alt, ...r.daten.eintraege]);
    setWeiter(r.daten.weiter);
  }

  async function loeschen(e: Eintrag) {
    setBusy(true);
    const r = await loescheEintrag(createClient(), e);
    setBusy(false);
    if (!r.ok) return setFehler("Das hat gerade nicht geklappt. Der Eintrag ist noch da.");
    setFehler("");
    setFrage(null);
    setEintraege((alt) => alt.filter((x) => x.id !== e.id));
  }

  return (
    <main className="page stack" data-narrow>
      <h1>Verlauf</h1>
      {eintraege.length === 0 && <p className="muted">Hier erscheinen deine Einheiten.</p>}
      {gruppiere(eintraege).map(({ monat, eintraege: liste }) => (
        <section key={monat} className="stack" aria-label={monat}>
          <h2>{monat}</h2>
          <ul className="sets">
            {liste.map((e) => (
              <li key={e.id}>
                <span className="muted">{zeit(e.started_at)}</span>
                {e.art === "workout" ? (
                  <Link href={`/training/verlauf/${e.id}`} className="link">
                    Training{e.ended_at ? "" : " (läuft)"}
                  </Link>
                ) : (
                  <span>
                    {e.activity} · {e.duration_min} Min{e.distance_km != null ? ` · ${km(e.distance_km)}` : ""}
                  </span>
                )}
                {frage === e.id ? (
                  <span className="actions-row">
                    <button type="button" className="link-button" disabled={busy} onClick={() => loeschen(e)}>
                      Ja, löschen
                    </button>
                    <button type="button" className="link-button" disabled={busy} onClick={() => setFrage(null)}>
                      Abbrechen
                    </button>
                  </span>
                ) : (
                  <button type="button" className="link-button" disabled={busy} aria-label={`Eintrag vom ${zeit(e.started_at)} löschen`}
                    onClick={() => setFrage(e.id)}>
                    Löschen
                  </button>
                )}
                {frage === e.id && <span className="muted">Wirklich löschen?</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {fehler && (
        <p role="alert" className="error">
          {fehler}
        </p>
      )}
      {weiter && (
        <button type="button" className="btn" data-variant="neutral" disabled={busy} onClick={mehr}>
          Mehr laden
        </button>
      )}
      <Link href="/training" className="link">
        Zurück
      </Link>
    </main>
  );
}
