"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "../../../../../lib/supabase/client";
import { beendeWorkout, letzteSaetze, loescheSatz, speichereSatz } from "../../../../../lib/training/log";

type Uebung = { id: string; name: string };
type Zeile = {
  exercise_id: string;
  exercises: { name: string } | null;
  set_no: number;
  reps: number;
  weight_kg: number | null;
  technique: "sauber" | "wackelig";
  pain: boolean;
};

const MAX_WDH = 500;
const MAX_KG = 1000;
const FEHLER = "Das hat gerade nicht geklappt. Der Satz ist nicht gespeichert. Bitte versuch es gleich noch einmal.";

const kg = (wert: number) => `${Number(wert).toLocaleString("de-DE")} kg`;
const beschreibe = (z: Zeile) =>
  [`Satz ${z.set_no}: ${z.reps} Wdh`, z.weight_kg === null ? "Körpergewicht" : kg(z.weight_kg), z.technique === "wackelig" && "wackelig", z.pain && "Schmerz"]
    .filter(Boolean)
    .join(" · ");

export function Protokoll({ workoutId, uebungen, saetze: start }: { workoutId: string; uebungen: Uebung[]; saetze: Zeile[] }) {
  const router = useRouter();
  const [saetze, setSaetze] = useState(start);
  const [uebung, setUebung] = useState(uebungen[0]?.id ?? "");
  const [wdh, setWdh] = useState("");
  const [gewicht, setGewicht] = useState("");
  const [wackelig, setWackelig] = useState(false);
  const [schmerz, setSchmerz] = useState(false);
  const [beenden, setBeenden] = useState(false);
  const [fehler, setFehler] = useState("");
  const [busy, setBusy] = useState(false);

  // Vorbelegung mit dem letzten Gewicht dieser Übung. Der Übungswechsel leert das Feld, damit kein Gewicht der vorigen
  // Übung stehen bleibt; ohne frühere Sätze oder nach Körpergewicht bleibt es leer. Eigene Eingaben werden nie überschrieben.
  const angefasst = useRef(false);
  function waehle(id: string) {
    angefasst.current = false;
    setGewicht("");
    setUebung(id);
  }
  useEffect(() => {
    if (!uebung) return;
    let aktuell = true;
    letzteSaetze(createClient(), uebung, 1).then((r) => {
      if (aktuell && !angefasst.current && r.ok && r.daten[0]?.weight_kg != null) setGewicht(String(Number(r.daten[0].weight_kg)));
    });
    return () => {
      aktuell = false;
    };
  }, [uebung]);

  async function speichern() {
    const anzahl = Number(wdh);
    const last = gewicht.trim() === "" ? null : Number(gewicht.replace(",", "."));
    if (wdh.trim() === "" || !Number.isInteger(anzahl) || anzahl < 0 || anzahl > MAX_WDH) {
      return setFehler(`Bitte gib die Wiederholungen als ganze Zahl von 0 bis ${MAX_WDH} ein.`);
    }
    if (last !== null && (!Number.isFinite(last) || last < 0 || last > MAX_KG)) {
      return setFehler(`Bitte gib das Gewicht von 0 bis ${MAX_KG} kg ein oder lass es für Körpergewicht leer.`);
    }
    const satzNr = Math.max(0, ...saetze.filter((s) => s.exercise_id === uebung).map((s) => s.set_no)) + 1;
    setFehler("");
    setBusy(true);
    const r = await speichereSatz(createClient(), {
      workoutId,
      exerciseId: uebung,
      satzNr,
      wdh: anzahl,
      gewichtKg: last,
      technik: wackelig ? "wackelig" : "sauber",
      schmerz,
    });
    setBusy(false);
    if (!r.ok) return setFehler(FEHLER);
    const name = uebungen.find((u) => u.id === uebung)?.name ?? "";
    setSaetze((s) => [
      ...s,
      { exercise_id: uebung, exercises: { name }, set_no: satzNr, reps: anzahl, weight_kg: last, technique: wackelig ? "wackelig" : "sauber", pain: schmerz },
    ]);
  }

  async function loeschen(z: Zeile) {
    setBusy(true);
    const r = await loescheSatz(createClient(), { workoutId, exerciseId: z.exercise_id, satzNr: z.set_no });
    setBusy(false);
    if (!r.ok) return setFehler("Das hat gerade nicht geklappt. Der Satz ist noch da.");
    setSaetze((s) => s.filter((x) => !(x.exercise_id === z.exercise_id && x.set_no === z.set_no)));
  }

  async function beende(regeneration?: "gut" | "schlecht") {
    setBusy(true);
    const r = await beendeWorkout(createClient(), workoutId, regeneration ? { regeneration } : {});
    setBusy(false);
    if (!r.ok) return setFehler("Das hat gerade nicht geklappt. Das Training läuft noch.");
    router.push("/training");
    router.refresh();
  }

  return (
    <main className="page stack" data-narrow>
      <h1>Training</h1>
      <div className="field">
        <label htmlFor="uebung">Übung</label>
        <select id="uebung" className="input" value={uebung} onChange={(e) => waehle(e.target.value)}>
          {uebungen.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="wdh">Wiederholungen</label>
        <input id="wdh" className="input" type="number" inputMode="numeric" min={0} max={MAX_WDH} step={1} autoComplete="off"
          value={wdh} onChange={(e) => setWdh(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="gewicht">Gewicht (kg)</label>
        <input id="gewicht" className="input" type="number" inputMode="decimal" min={0} max={MAX_KG} step={0.25} autoComplete="off"
          aria-describedby="gewicht-hinweis" value={gewicht} onChange={(e) => { angefasst.current = true; setGewicht(e.target.value); }} />
        <p id="gewicht-hinweis" className="muted">Leer lassen für Körpergewicht.</p>
      </div>
      <Schalter name="Technik wackelig" an={wackelig} setze={setWackelig} />
      <Schalter name="Schmerz" an={schmerz} setze={setSchmerz} />
      <button type="button" className="btn" disabled={busy || !uebung} onClick={speichern}>
        Satz speichern
      </button>
      {fehler && (
        <p role="alert" className="error">
          {fehler}
        </p>
      )}

      <section className="stack">
        <h2>Sätze</h2>
        {saetze.length === 0 ? (
          <p className="muted">Noch keine Sätze.</p>
        ) : (
          <ul className="sets">
            {saetze.map((z) => (
              <li key={`${z.exercise_id}-${z.set_no}`}>
                <span className="muted">{z.exercises?.name}</span>
                <span>{beschreibe(z)}</span>
                <button type="button" className="link-button" disabled={busy} aria-label={`Satz ${z.set_no} ${z.exercises?.name ?? ""} löschen`}
                  onClick={() => loeschen(z)}>
                  Löschen
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {beenden ? (
        <section className="card stack">
          <h2>Wie fühlst du dich? (freiwillig)</h2>
          <div className="actions">
            <button type="button" className="btn" data-variant="neutral" disabled={busy} onClick={() => beende("gut")}>
              gut
            </button>
            <button type="button" className="btn" data-variant="neutral" disabled={busy} onClick={() => beende("schlecht")}>
              eher schlecht
            </button>
          </div>
          <button type="button" className="link-button" disabled={busy} onClick={() => beende()}>
            Überspringen
          </button>
        </section>
      ) : (
        <button type="button" className="btn" data-variant="neutral" onClick={() => setBeenden(true)}>
          Training beenden
        </button>
      )}
    </main>
  );
}

function Schalter({ name, an, setze }: { name: string; an: boolean; setze: (an: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={an} className="toggle switch" onClick={() => setze(!an)}>
      <span className="switch-track" aria-hidden="true" />
      {name}
    </button>
  );
}
