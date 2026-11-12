"use client";

import Link from "next/link";
import { useState } from "react";
import { KUECHENGERAETE, type Kuechengeraet } from "../../../../lib/kochen/geraete";
import { entferneGeraet, speichereGeraet, type Geraetezeile } from "../../../../lib/kochen/kueche";
import { createClient } from "../../../../lib/supabase/client";

const FEHLER = "Das hat gerade nicht geklappt. Bitte versuch es gleich noch einmal.";

export function Kuechengeraete({ start }: { start: Geraetezeile[] }) {
  const [geraete, setGeraete] = useState<Partial<Record<Kuechengeraet, string>>>(Object.fromEntries(start.map((g) => [g.kind, g.model ?? ""])));
  const [fehler, setFehler] = useState("");
  const [busy, setBusy] = useState(false);

  // Der Haken wechselt sofort und wird im Hintergrund gespeichert; bei einem Fehler springt er zurück.
  async function umschalten(kind: Kuechengeraet) {
    const vorher = geraete;
    const an = kind in geraete;
    const neu = { ...geraete };
    if (an) delete neu[kind];
    else neu[kind] = "";
    setGeraete(neu);
    setBusy(true);
    const r = an ? await entferneGeraet(createClient(), kind) : await speichereGeraet(createClient(), kind);
    setBusy(false);
    if (!r.ok) {
      setGeraete(vorher);
      return setFehler(FEHLER);
    }
    setFehler("");
  }

  async function speichereModell(kind: Kuechengeraet) {
    const r = await speichereGeraet(createClient(), kind, geraete[kind] ?? null);
    setFehler(r.ok ? "" : FEHLER);
  }

  return (
    <main className="page stack" data-narrow>
      <h1>Meine Küchengeräte</h1>
      <p className="muted">Rezepte, für die dir ein Gerät fehlt, schlägt die App nicht vor. Das Modell ist freiwillig.</p>
      <fieldset className="choices">
        <legend>Was steht in deiner Küche?</legend>
        {(Object.entries(KUECHENGERAETE) as [Kuechengeraet, string][]).map(([kind, text]) => (
          <div key={kind} className="stack">
            <label className="toggle">
              <input type="checkbox" checked={kind in geraete} disabled={busy} onChange={() => umschalten(kind)} />
              {text}
            </label>
            {kind in geraete && (
              <div className="field">
                <label htmlFor={`modell-${kind}`}>Modell von {text} (freiwillig)</label>
                <input id={`modell-${kind}`} className="input" maxLength={80} autoComplete="off" value={geraete[kind] ?? ""}
                  onChange={(e) => setGeraete({ ...geraete, [kind]: e.target.value })} onBlur={() => speichereModell(kind)} />
              </div>
            )}
          </div>
        ))}
      </fieldset>
      {fehler && (
        <p role="alert" className="error">
          {fehler}
        </p>
      )}
      <Link href="/kochen" className="link">
        Zurück
      </Link>
    </main>
  );
}
