"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  gleicherTag,
  istGueltigeMenge,
  letzteTage,
  loescheWasser,
  MENGE_MAX,
  MENGE_MIN,
  tagessumme,
  trageWasserEin,
  type Wassereintrag,
} from "../../../../lib/essen/wasser";
import { createClient } from "../../../../lib/supabase/client";

const SCHNELL = [250, 500];
const FEHLER = "Das hat gerade nicht geklappt. Der Eintrag ist nicht gespeichert. Bitte versuch es gleich noch einmal.";

const ml = (wert: number) => `${wert.toLocaleString("de-DE")} ml`;
const uhrzeit = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
const wochentag = (tag: Date) => tag.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });

// Summen hängen an der Zeitzone des Geräts: erst im Browser rechnen, auf dem Server nur einen Platzhalter zeigen.
const leer = () => () => {};
const useImBrowser = () => useSyncExternalStore(leer, () => true, () => false);

export function Wasser({ eintraege: start }: { eintraege: Wassereintrag[] }) {
  const imBrowser = useImBrowser();
  const [eintraege, setEintraege] = useState(start);
  const [menge, setMenge] = useState("");
  const [fehler, setFehler] = useState("");
  const [busy, setBusy] = useState(false);

  async function eintragen(wert: number) {
    if (!istGueltigeMenge(wert)) return setFehler(`Bitte gib die Menge als ganze Zahl von ${MENGE_MIN} bis ${MENGE_MAX} ml ein.`);
    setFehler("");
    setBusy(true);
    const r = await trageWasserEin(createClient(), wert, { id: crypto.randomUUID() });
    setBusy(false);
    if (!r.ok) return setFehler(FEHLER);
    setEintraege((e) => [r.daten, ...e]);
    setMenge("");
  }

  async function loeschen(id: string) {
    setBusy(true);
    const r = await loescheWasser(createClient(), id);
    setBusy(false);
    if (!r.ok) return setFehler("Das hat gerade nicht geklappt. Der Eintrag ist noch da.");
    setEintraege((e) => e.filter((x) => x.id !== id));
  }

  const jetzt = new Date();
  const heute = imBrowser
    ? eintraege.filter((e) => gleicherTag(new Date(e.logged_at), jetzt)).sort((a, b) => b.logged_at.localeCompare(a.logged_at))
    : [];
  const tage = imBrowser ? letzteTage(eintraege, jetzt) : [];
  const hoechste = Math.max(0, ...tage.map((t) => t.summe));

  return (
    <main className="page stack" data-narrow>
      <h1>Wasser</h1>
      <section className="stack" aria-labelledby="heute">
        <h2 id="heute">Heute</h2>
        <p className="wasser-summe" data-testid="tagessumme">
          {imBrowser ? ml(tagessumme(eintraege, jetzt)) : "…"}
        </p>
        <div className="actions-row">
          {SCHNELL.map((wert) => (
            <button key={wert} type="button" className="btn" disabled={busy} onClick={() => eintragen(wert)}>
              + {ml(wert)}
            </button>
          ))}
        </div>
        <div className="field">
          <label htmlFor="menge">Menge (ml)</label>
          <input id="menge" className="input" type="number" inputMode="numeric" min={MENGE_MIN} max={MENGE_MAX} step={1}
            autoComplete="off" value={menge} onChange={(e) => setMenge(e.target.value)} />
        </div>
        <button type="button" className="btn" data-variant="neutral" disabled={busy}
          onClick={() => eintragen(menge.trim() === "" ? Number.NaN : Number(menge))}>
          Eintragen
        </button>
        {fehler && (
          <p role="alert" className="error">
            {fehler}
          </p>
        )}
        {imBrowser && heute.length === 0 ? (
          <p className="muted">Heute noch nichts eingetragen.</p>
        ) : (
          <ul className="sets" aria-label="Einträge heute">
            {heute.map((e) => (
              <li key={e.id}>
                <span>{ml(e.amount_ml)}</span>
                <button type="button" className="link-button" disabled={busy} onClick={() => loeschen(e.id)}>
                  Löschen
                </button>
                <span className="muted">{uhrzeit(e.logged_at)} Uhr</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="stack" aria-labelledby="verlauf">
        <h2 id="verlauf">Letzte 7 Tage</h2>
        <ul className="balken" aria-label="Verlauf der letzten 7 Tage">
          {tage.map(({ tag, summe }) => (
            <li key={tag.toISOString()}>
              <span>{wochentag(tag)}</span>
              <span className="balken-spur" aria-hidden="true">
                <span style={{ width: `${hoechste ? (summe / hoechste) * 100 : 0}%` }} />
              </span>
              <span>{ml(summe)}</span>
            </li>
          ))}
        </ul>
      </section>
      <Link href="/essen" className="link">
        Zurück
      </Link>
    </main>
  );
}
