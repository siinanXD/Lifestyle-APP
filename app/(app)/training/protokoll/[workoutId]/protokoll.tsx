"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "../../../../../lib/supabase/client";
import { vergissComeback } from "../../../../../lib/training/comeback-ablauf";
import { STANDARD_ZIEL } from "../../../../../lib/training/uebungskarte";
import { ExerciseCard } from "./exercise-card";
import { beendeWorkout, letzteSaetze, loescheSatz, saetzeDesWorkouts, speichereSatz } from "../../../../../lib/training/log";

type Uebung = { id: string; name: string; muscle_groups?: string[]; technique?: string };
type Vorgabe = { exercise_id: string; name: string; sets: number; rep_min: number; rep_max: number };
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

export function Protokoll({
  workoutId,
  uebungen,
  saetze: start,
  geplant = [],
  stufeKg = 2.5,
}: {
  workoutId: string;
  uebungen: Uebung[];
  saetze: Zeile[];
  /** Übungen des Plantags (SIN-1285); leer = freies Training. */
  geplant?: Vorgabe[];
  /** Kleinste Gewichtsstufe aus dem Profil (SIN-1271) für die Empfehlung der Übungskarte. */
  stufeKg?: number;
}) {
  const router = useRouter();
  const [saetze, setSaetze] = useState(start);
  // Mit Plan startet die Auswahl bei der ersten geplanten Übung, die noch offen ist; die Wiederholungen sind mit dem unteren Ziel vorbelegt.
  const erledigt = (v: Vorgabe, liste: Zeile[]) => liste.filter((s) => s.exercise_id === v.exercise_id).length;
  const ersteOffene = geplant.find((v) => erledigt(v, start) < v.sets) ?? geplant[0];
  const [uebung, setUebung] = useState(ersteOffene?.exercise_id ?? uebungen[0]?.id ?? "");
  const [wdh, setWdh] = useState(ersteOffene ? String(ersteOffene.rep_min) : "");
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
    const vorgabe = geplant.find((v) => v.exercise_id === id);
    if (vorgabe) setWdh(String(vorgabe.rep_min));
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

  const aktuelleUebung = uebungen.find((u) => u.id === uebung);
  const vorgabeZiel = geplant.find((v) => v.exercise_id === uebung);

  async function speichern() {
    const anzahl = Number(wdh);
    const last = gewicht.trim() === "" ? null : Number(gewicht.replace(",", "."));
    if (wdh.trim() === "" || !Number.isInteger(anzahl) || anzahl < 0 || anzahl > MAX_WDH) {
      return setFehler(`Bitte gib die Wiederholungen als ganze Zahl von 0 bis ${MAX_WDH} ein.`);
    }
    if (last !== null && (!Number.isFinite(last) || last < 0 || last > MAX_KG)) {
      return setFehler(`Bitte gib das Gewicht von 0 bis ${MAX_KG} kg ein oder lass es für Körpergewicht leer.`);
    }
    const naechste = (liste: Zeile[]) => Math.max(0, ...liste.filter((s) => s.exercise_id === uebung).map((s) => s.set_no)) + 1;
    const client = createClient();
    const sende = (nr: number) =>
      speichereSatz(
        client,
        { workoutId, exerciseId: uebung, satzNr: nr, wdh: anzahl, gewichtKg: last, technik: wackelig ? "wackelig" : "sauber", schmerz },
        { nurNeu: true },
      );
    let satzNr = naechste(saetze);
    setFehler("");
    setBusy(true);
    let r = await sende(satzNr);
    // Nummer schon vergeben (z. B. Satz aus einem zweiten Fenster): Liste neu laden und einmal mit der nächsten Nummer versuchen.
    if (!r.ok && r.fehler === "23505") {
      const neu = await saetzeDesWorkouts(client, workoutId);
      if (neu.ok) {
        setSaetze(neu.daten);
        satzNr = naechste(neu.daten);
        r = await sende(satzNr);
      }
    }
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
    // Die Rückkehr nach Pause (SIN-1281) gilt bis zum nächsten beendeten Training.
    vergissComeback();
    router.push("/training");
    router.refresh();
  }

  return (
    <main className="page stack" data-narrow>
      <h1>Training</h1>
      {geplant.length > 0 && (
        <section className="card stack" aria-label="Geplant">
          <h2>Geplant</h2>
          <ul className="sets">
            {geplant.map((v) => (
              <li key={v.exercise_id}>
                <span>
                  {v.name}: {v.sets} × {v.rep_min}–{v.rep_max}
                </span>
                <button type="button" className="link-button" aria-current={uebung === v.exercise_id ? "true" : undefined}
                  aria-label={`${v.name} auswählen`} onClick={() => waehle(v.exercise_id)}>
                  {Math.min(erledigt(v, saetze), v.sets)} von {v.sets}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
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
      {aktuelleUebung && (
        <ExerciseCard
          uebung={aktuelleUebung}
          workoutId={workoutId}
          ziel={vorgabeZiel ? { wdhMin: vorgabeZiel.rep_min, wdhMax: vorgabeZiel.rep_max } : STANDARD_ZIEL}
          stufeKg={stufeKg}
          onUebernehmen={(kgWert) => {
            angefasst.current = true;
            setGewicht(String(kgWert));
          }}
        />
      )}
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
