"use client";

import Link from "next/link";
import { useState } from "react";
import { entferneEinkauf, hakeAb, ladeEinkauf, legeInVorrat, pruefeEinkauf, setzeAufListe, type Einkaufszeile } from "../../../../lib/kochen/einkauf";
import { EINHEITEN, FEHLERTEXTE, mengeText } from "../../../../lib/kochen/kueche";
import { ZUTATNAMEN } from "../../../../lib/kochen/zutaten";
import { createClient } from "../../../../lib/supabase/client";

const LEER = { name: "", menge: "", einheit: "" };
const NICHT_GEKLAPPT = "Das hat gerade nicht geklappt. Bitte versuch es gleich noch einmal.";

export function Einkaufsliste({ start }: { start: Einkaufszeile[] }) {
  const [liste, setListe] = useState(start);
  const [form, setForm] = useState(LEER);
  const [fehler, setFehler] = useState<string[]>([]);
  const [hinweis, setHinweis] = useState("");
  const [busy, setBusy] = useState(false);
  const feld = (name: keyof typeof LEER) => ({ value: form[name], onChange: (e: { target: { value: string } }) => setForm({ ...form, [name]: e.target.value }) });
  const offen = liste.filter((z) => !z.done);
  const erledigt = liste.filter((z) => z.done);

  /** Nach jedem Schreiben neu laden: Zusammenfassen passiert beim Speichern, die Liste soll zeigen, was wirklich gespeichert ist. */
  async function schreibe(aktion: () => Promise<{ ok: boolean }>, danach = "") {
    setBusy(true);
    setFehler([]);
    setHinweis("");
    const r = await aktion();
    const neu = await ladeEinkauf(createClient());
    setBusy(false);
    if (neu.ok) setListe(neu.daten ?? []);
    if (!r.ok || !neu.ok) return setFehler([NICHT_GEKLAPPT]);
    setHinweis(danach);
    return true;
  }

  async function hinzufuegen() {
    const pruefung = pruefeEinkauf(form);
    if (!pruefung.ok) return setFehler(pruefung.fehler.map((f) => FEHLERTEXTE[f]));
    if (await schreibe(() => setzeAufListe(createClient(), [pruefung.werte]))) setForm(LEER);
  }

  const zeile = (z: Einkaufszeile) => (
    <li key={z.id}>
      <label className="toggle">
        <input type="checkbox" checked={z.done} disabled={busy} onChange={() => schreibe(() => hakeAb(createClient(), z.id, !z.done))} />
        {[z.name, mengeText(z)].filter(Boolean).join(" · ")}
      </label>
      <button type="button" className="link-button" disabled={busy} aria-label={`${z.name} löschen`} onClick={() => schreibe(() => entferneEinkauf(createClient(), z.id))}>
        Löschen
      </button>
    </li>
  );

  return (
    <main className="page stack" data-narrow>
      <h1>Einkaufsliste</h1>
      {liste.length === 0 && <p className="muted">Die Liste ist leer. Trag unten etwas ein oder übernimm im Rezept, was fehlt.</p>}
      {offen.length > 0 && (
        <section className="stack" aria-label="Noch zu kaufen">
          <h2>Noch zu kaufen</h2>
          <ul className="sets">{offen.map(zeile)}</ul>
        </section>
      )}
      {erledigt.length > 0 && (
        <section className="stack" aria-label="Erledigt">
          <h2>Erledigt</h2>
          <ul className="sets">{erledigt.map(zeile)}</ul>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => schreibe(() => legeInVorrat(createClient()), `${erledigt.length === 1 ? "1 Eintrag liegt" : `${erledigt.length} Einträge liegen`} jetzt im Vorrat unter Kühlschrank.`)}
          >
            Erledigtes in den Vorrat legen
          </button>
          <p className="muted">Die Einträge landen unter Kühlschrank. Den Ort kannst du im Vorrat ändern.</p>
        </section>
      )}
      {hinweis && (
        <p role="status">
          {hinweis}{" "}
          <Link href="/kochen/vorrat" className="link">
            Zum Vorrat
          </Link>
        </p>
      )}

      <section className="card stack" aria-labelledby="formular">
        <h2 id="formular">Hinzufügen</h2>
        <div className="field">
          <label htmlFor="name">Was brauchst du?</label>
          <input id="name" className="input" maxLength={80} autoComplete="off" list="zutaten" {...feld("name")} />
          <datalist id="zutaten">
            {ZUTATNAMEN.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label htmlFor="menge">Menge (freiwillig)</label>
          <input id="menge" className="input" inputMode="decimal" autoComplete="off" {...feld("menge")} />
        </div>
        <div className="field">
          <label htmlFor="einheit">Einheit</label>
          <select id="einheit" className="input" {...feld("einheit")}>
            <option value="">ohne</option>
            {Object.entries(EINHEITEN).map(([k, text]) => (
              <option key={k} value={k}>
                {text}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn" disabled={busy} onClick={hinzufuegen}>
          Hinzufügen
        </button>
        {fehler.length > 0 && (
          <div role="alert" className="error">
            {fehler.map((f) => (
              <p key={f}>{f}</p>
            ))}
          </div>
        )}
      </section>
      <Link href="/kochen" className="link">
        Zurück
      </Link>
    </main>
  );
}
