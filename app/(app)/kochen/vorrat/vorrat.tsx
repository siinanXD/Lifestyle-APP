"use client";

import Link from "next/link";
import { useState } from "react";
import { EINHEITEN, entferneVorrat, FEHLERTEXTE, mengeText, ORTE, pruefeVorrat, speichereVorrat, type Ort, type Vorratszeile } from "../../../../lib/kochen/kueche";
import { ZUTATNAMEN } from "../../../../lib/kochen/zutaten";
import { createClient } from "../../../../lib/supabase/client";

const LEER = { name: "", menge: "", einheit: "", ort: "kuehlschrank", haltbarBis: "" };
const datum = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

export function Vorrat({ start }: { start: Vorratszeile[] }) {
  const [liste, setListe] = useState(start);
  const [form, setForm] = useState(LEER);
  const [bearbeite, setBearbeite] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const feld = (name: keyof typeof LEER) => ({ value: form[name], onChange: (e: { target: { value: string } }) => setForm({ ...form, [name]: e.target.value }) });

  function abbrechen() {
    setBearbeite(null);
    setForm({ ...LEER, ort: form.ort }); // der Ort bleibt, wer den Kühlschrank einräumt, trägt mehrere Dinge ein
    setFehler([]);
  }

  async function speichern() {
    const pruefung = pruefeVorrat(form);
    if (!pruefung.ok) return setFehler(pruefung.fehler.map((f) => FEHLERTEXTE[f]));
    const id = bearbeite ?? crypto.randomUUID();
    setBusy(true);
    const r = await speichereVorrat(createClient(), id, pruefung.werte);
    setBusy(false);
    if (!r.ok) return setFehler(["Das hat gerade nicht geklappt. Der Eintrag ist nicht gespeichert. Bitte versuch es gleich noch einmal."]);
    setListe((alt) => [...alt.filter((z) => z.id !== id), { id, ...pruefung.werte }].sort((a, b) => a.name.localeCompare(b.name, "de")));
    abbrechen();
  }

  async function loeschen(id: string) {
    setBusy(true);
    const r = await entferneVorrat(createClient(), id);
    setBusy(false);
    if (!r.ok) return setFehler(["Das hat gerade nicht geklappt. Der Eintrag ist noch da."]);
    setListe((alt) => alt.filter((z) => z.id !== id));
    if (bearbeite === id) abbrechen();
  }

  function aendere(z: Vorratszeile) {
    setFehler([]);
    setBearbeite(z.id);
    setForm({ name: z.name, menge: z.amount === null ? "" : String(Number(z.amount)).replace(".", ","), einheit: z.unit ?? "", ort: z.location, haltbarBis: z.best_before ?? "" });
  }

  return (
    <main className="page stack" data-narrow>
      <h1>Mein Vorrat</h1>
      {liste.length === 0 && <p className="muted">Noch nichts eingetragen. Fang mit dem an, was gerade im Kühlschrank liegt.</p>}
      {(Object.entries(ORTE) as [Ort, string][]).map(([ort, titel]) => {
        const hier = liste.filter((z) => z.location === ort);
        if (hier.length === 0) return null;
        return (
          <section key={ort} className="stack" aria-label={titel}>
            <h2>{titel}</h2>
            <ul className="sets">
              {hier.map((z) => (
                <li key={z.id}>
                  <span>{[z.name, mengeText(z)].filter(Boolean).join(" · ")}</span>
                  <span className="actions-row">
                    <button type="button" className="link-button" disabled={busy} aria-label={`${z.name} ändern`} onClick={() => aendere(z)}>
                      Ändern
                    </button>
                    <button type="button" className="link-button" disabled={busy} aria-label={`${z.name} löschen`} onClick={() => loeschen(z.id)}>
                      Löschen
                    </button>
                  </span>
                  {(z.best_before || !z.ingredient_key) && (
                    <span className="muted">
                      {[z.best_before && `haltbar bis ${datum(z.best_before)}`, !z.ingredient_key && "zählt nicht für Rezepte (unbekannte Zutat)"].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="card stack" aria-labelledby="formular">
        <h2 id="formular">{bearbeite ? "Eintrag ändern" : "Hinzufügen"}</h2>
        <div className="field">
          <label htmlFor="name">Was hast du da?</label>
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
        <div className="field">
          <label htmlFor="ort">Wo liegt es?</label>
          <select id="ort" className="input" {...feld("ort")}>
            {Object.entries(ORTE).map(([k, text]) => (
              <option key={k} value={k}>
                {text}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="haltbar">Haltbar bis (freiwillig)</label>
          <input id="haltbar" className="input" type="date" {...feld("haltbarBis")} />
        </div>
        <button type="button" className="btn" disabled={busy} onClick={speichern}>
          {bearbeite ? "Änderung speichern" : "Hinzufügen"}
        </button>
        {bearbeite && (
          <button type="button" className="btn" data-variant="neutral" disabled={busy} onClick={abbrechen}>
            Abbrechen
          </button>
        )}
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
