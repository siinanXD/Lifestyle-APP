"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../../../lib/supabase/client";
import {
  aenderePosition,
  entfernePosition,
  istGueltigePosition,
  loeschePlan,
  type AktiverPlan,
  type Planposition,
} from "../../../../lib/training/plan-ablauf";

const FEHLER = "Das hat gerade nicht geklappt. Dein Plan ist unverändert. Bitte versuch es gleich noch einmal.";
const UNGUELTIG = "Bitte gib 1 bis 10 Sätze und 1 bis 100 Wiederholungen ein, die kleinere Zahl zuerst.";

export function PlanAnsicht({ plan: start, uebungen }: { plan: AktiverPlan; uebungen: { id: string; name: string }[] }) {
  const router = useRouter();
  const [plan, setPlan] = useState(start);
  const [offen, setOffen] = useState<string | null>(null); // id der Position in Bearbeitung
  const [entwurf, setEntwurf] = useState({ exercise_id: "", sets: "", rep_min: "", rep_max: "" });
  const [loeschen, setLoeschen] = useState(false);
  const [fehler, setFehler] = useState("");
  const [busy, setBusy] = useState(false);

  function bearbeite(p: Planposition) {
    setFehler("");
    setOffen(p.id);
    setEntwurf({ exercise_id: p.exercise_id, sets: String(p.sets), rep_min: String(p.rep_min), rep_max: String(p.rep_max) });
  }

  const mitPositionen = (aendere: (liste: Planposition[]) => Planposition[]): AktiverPlan => ({
    ...plan,
    source: "manuell",
    tage: plan.tage.map((t) => ({ ...t, positionen: aendere(t.positionen) })).filter((t) => t.positionen.length > 0),
  });

  async function speichern(p: Planposition) {
    const werte = { exercise_id: entwurf.exercise_id, sets: Number(entwurf.sets), rep_min: Number(entwurf.rep_min), rep_max: Number(entwurf.rep_max) };
    if (!istGueltigePosition(werte)) return setFehler(UNGUELTIG);
    setBusy(true);
    const r = await aenderePosition(createClient(), plan.id, p.id, werte);
    setBusy(false);
    if (!r.ok) return setFehler(FEHLER);
    const name = uebungen.find((u) => u.id === werte.exercise_id)?.name ?? p.name;
    setPlan(mitPositionen((liste) => liste.map((x) => (x.id === p.id ? { ...x, ...werte, name, slug: x.exercise_id === werte.exercise_id ? x.slug : null } : x))));
    setOffen(null);
    setFehler("");
  }

  async function entfernen(p: Planposition) {
    setBusy(true);
    const r = await entfernePosition(createClient(), plan.id, p.id);
    setBusy(false);
    if (!r.ok) return setFehler(FEHLER);
    setPlan(mitPositionen((liste) => liste.filter((x) => x.id !== p.id)));
    setOffen(null);
  }

  async function planLoeschen() {
    setBusy(true);
    const r = await loeschePlan(createClient(), plan.id);
    if (!r.ok) {
      setBusy(false);
      return setFehler(FEHLER);
    }
    router.push("/training");
    router.refresh();
  }

  const feld = (name: "sets" | "rep_min" | "rep_max", label: string, max: number, id: string) => (
    <div className="field">
      <label htmlFor={`${name}-${id}`}>{label}</label>
      <input id={`${name}-${id}`} className="input" type="number" inputMode="numeric" min={1} max={max} step={1} autoComplete="off"
        value={entwurf[name]} onChange={(e) => setEntwurf({ ...entwurf, [name]: e.target.value })} />
    </div>
  );

  return (
    <main className="page stack">
      <p className="eyebrow">{plan.source === "manuell" ? "Von dir angepasst" : plan.general ? "Allgemeiner Vorschlag" : "Aus deinen Angaben"}</p>
      <h1>{plan.name}</h1>
      <p className="muted">Der Plan ist ein Vorschlag. Die Reihenfolge zählt, nicht der Wochentag.</p>
      {plan.tage.length === 0 && <p className="muted">Der Plan hat keine Übungen mehr.</p>}
      {plan.tage.map((tag) => (
        <section key={tag.tagNr} className="card stack" aria-label={`Tag ${tag.tagNr}`}>
          <h2>Tag {tag.tagNr}</h2>
          <ul className="sets">
            {tag.positionen.map((p) => (
              <li key={p.id}>
                <span>
                  {p.slug ? (
                    <Link href={`/training/uebungen/${p.slug}`} className="link">
                      {p.name}
                    </Link>
                  ) : (
                    p.name
                  )}
                  : {p.sets} × {p.rep_min}–{p.rep_max}
                </span>
                <button type="button" className="link-button" disabled={busy} aria-label={`${p.name} an Tag ${tag.tagNr} ändern`}
                  onClick={() => (offen === p.id ? setOffen(null) : bearbeite(p))}>
                  {offen === p.id ? "Schließen" : "Ändern"}
                </button>
                {offen === p.id && (
                  <div className="stack" style={{ gridColumn: "1 / -1" }}>
                    <div className="field">
                      <label htmlFor={`uebung-${p.id}`}>Übung</label>
                      <select id={`uebung-${p.id}`} className="input" value={entwurf.exercise_id}
                        onChange={(e) => setEntwurf({ ...entwurf, exercise_id: e.target.value })}>
                        {uebungen.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {feld("sets", "Sätze", 10, p.id)}
                    {feld("rep_min", "Wiederholungen von", 100, p.id)}
                    {feld("rep_max", "Wiederholungen bis", 100, p.id)}
                    <button type="button" className="btn" disabled={busy} onClick={() => speichern(p)}>
                      Speichern
                    </button>
                    <button type="button" className="btn" data-variant="neutral" disabled={busy} onClick={() => entfernen(p)}>
                      Übung entfernen
                    </button>
                  </div>
                )}
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
      <Link href="/training/plan/neu" className="btn" data-variant="neutral">
        Neuen Plan erstellen
      </Link>
      {loeschen ? (
        <section className="card stack">
          <h2>Plan wirklich löschen?</h2>
          <p className="muted">Deine Trainings bleiben erhalten.</p>
          <div className="actions">
            <button type="button" className="btn" data-variant="danger" disabled={busy} onClick={planLoeschen}>
              Ja, löschen
            </button>
            <button type="button" className="btn" data-variant="neutral" disabled={busy} onClick={() => setLoeschen(false)}>
              Abbrechen
            </button>
          </div>
        </section>
      ) : (
        <button type="button" className="link-button" onClick={() => setLoeschen(true)}>
          Plan löschen
        </button>
      )}
    </main>
  );
}
