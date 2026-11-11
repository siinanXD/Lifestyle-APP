"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HINWEIS_FREITEXT } from "../../../../lib/onboarding/texte";
import { createClient } from "../../../../lib/supabase/client";
import { AKTIVITAET_KATEGORIEN, FEHLERTEXTE, mitStrecke, pruefeAktivitaet, trageAktivitaetEin, type Kategorie } from "../../../../lib/training/aktivitaet";

const FEHLER = "Das hat gerade nicht geklappt. Der Eintrag ist nicht gespeichert. Bitte versuch es gleich noch einmal.";

export function AktivitaetFormular({ vorschlaege }: { vorschlaege: { name: string; category: string }[] }) {
  const router = useRouter();
  const [kategorie, setKategorie] = useState<Kategorie>("cardio");
  const [aktivitaet, setAktivitaet] = useState("");
  const [dauer, setDauer] = useState("");
  const [strecke, setStrecke] = useState("");
  const [anstrengung, setAnstrengung] = useState<number | null>(null);
  const [notiz, setNotiz] = useState("");
  const [fehler, setFehler] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function speichern() {
    const pruefung = pruefeAktivitaet({ kategorie, aktivitaet, dauerMin: dauer, streckeKm: strecke, anstrengung, notiz });
    if (!pruefung.ok) return setFehler(pruefung.fehler.map((f) => FEHLERTEXTE[f]));
    setFehler([]);
    setBusy(true);
    const r = await trageAktivitaetEin(createClient(), pruefung.werte);
    if (!r.ok) {
      setBusy(false);
      return setFehler([FEHLER]);
    }
    router.push("/training/verlauf");
    router.refresh();
  }

  return (
    <main className="page stack" data-narrow>
      <h1>Aktivität eintragen</h1>
      <div className="chips" role="group" aria-label="Kategorie">
        {(Object.entries(AKTIVITAET_KATEGORIEN) as [Kategorie, string][]).map(([k, text]) => (
          <button key={k} type="button" aria-pressed={kategorie === k} className="chip" onClick={() => setKategorie(k)}>
            {text}
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="aktivitaet">Was hast du gemacht?</label>
        <input id="aktivitaet" className="input" maxLength={60} autoComplete="off" value={aktivitaet} onChange={(e) => setAktivitaet(e.target.value)} />
        <div className="chips" aria-label="Schnellwahl">
          {vorschlaege
            .filter((v) => v.category === kategorie)
            .map((v) => (
              <button key={v.name} type="button" className="chip" aria-pressed={aktivitaet === v.name} onClick={() => setAktivitaet(v.name)}>
                {v.name}
              </button>
            ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="dauer">Dauer (Minuten)</label>
        <input id="dauer" className="input" type="number" inputMode="numeric" min={1} max={1440} step={1} autoComplete="off" value={dauer}
          onChange={(e) => setDauer(e.target.value)} />
      </div>
      {mitStrecke(kategorie) && (
        <div className="field">
          <label htmlFor="strecke">Strecke in km (freiwillig)</label>
          <input id="strecke" className="input" inputMode="decimal" autoComplete="off" value={strecke} onChange={(e) => setStrecke(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label htmlFor="anstrengung">Gefühlte Anstrengung (freiwillig): {anstrengung ?? "nicht angegeben"}</label>
        <input id="anstrengung" type="range" min={1} max={10} step={1} value={anstrengung ?? 5} onChange={(e) => setAnstrengung(Number(e.target.value))} />
        {anstrengung !== null && (
          <button type="button" className="link-button" onClick={() => setAnstrengung(null)}>
            Angabe entfernen
          </button>
        )}
      </div>
      <div className="field">
        <label htmlFor="notiz">Notiz (freiwillig)</label>
        <textarea id="notiz" className="input" maxLength={200} rows={2} aria-describedby="notiz-hinweis" value={notiz} onChange={(e) => setNotiz(e.target.value)} />
        <p id="notiz-hinweis" className="muted">
          {HINWEIS_FREITEXT}
        </p>
      </div>
      <button type="button" className="btn" disabled={busy} onClick={speichern}>
        Speichern
      </button>
      {fehler.length > 0 && (
        <div role="alert" className="error">
          {fehler.map((f) => (
            <p key={f}>{f}</p>
          ))}
        </div>
      )}
      <Link href="/training" className="link">
        Zurück
      </Link>
    </main>
  );
}
