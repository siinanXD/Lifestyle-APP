"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "../../../../lib/supabase/client";
import { bereinigeGeraete, GERAETE, istGueltigeStufe, KEINE, speichereGeraete, STUFE_MAX, STUFE_MIN, type Geraet } from "../../../../lib/training/geraete";

const zahl = (kg: number) => kg.toLocaleString("de-DE");

export function GeraeteFormular({ geraete: start, stufeKg }: { geraete: string[]; stufeKg: number }) {
  const [geraete, setGeraete] = useState<Geraet[]>(bereinigeGeraete(start));
  const [stufe, setStufe] = useState(String(stufeKg).replace(".", ","));
  const [meldung, setMeldung] = useState<{ art: "fehler" | "ok" | "einwilligung"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // „Nichts, nur ich“ schließt alle anderen aus und umgekehrt.
  function umschalten(g: Geraet) {
    setMeldung(null);
    if (g === KEINE) return setGeraete(geraete.includes(KEINE) ? [] : [KEINE]);
    setGeraete(bereinigeGeraete(geraete.includes(g) ? geraete.filter((x) => x !== g) : [...geraete.filter((x) => x !== KEINE), g]));
  }

  async function speichern() {
    const kg = Number(stufe.replace(",", "."));
    if (stufe.trim() === "" || !istGueltigeStufe(kg)) {
      return setMeldung({ art: "fehler", text: `Bitte gib die kleinste Gewichtsstufe von ${zahl(STUFE_MIN)} bis ${zahl(STUFE_MAX)} kg ein.` });
    }
    setBusy(true);
    const { error } = await speichereGeraete(createClient(), { geraete, stufeKg: kg });
    setBusy(false);
    if (error?.code === "keine_einwilligung") {
      return setMeldung({ art: "einwilligung", text: "Zum Speichern deiner Geräte brauchen wir deine Einwilligung „Profil & Gewohnheiten“." });
    }
    if (error) return setMeldung({ art: "fehler", text: "Das hat gerade nicht geklappt. Deine Geräte sind unverändert. Bitte versuch es gleich noch einmal." });
    setMeldung({ art: "ok", text: "Gespeichert." });
  }

  return (
    <main className="page stack" data-narrow>
      <h1>Meine Geräte</h1>
      <p className="muted">Plan und Übungsbibliothek richten sich danach. Du kannst das jederzeit ändern.</p>
      <fieldset className="choices">
        <legend>Was hast du zum Trainieren?</legend>
        {(Object.entries(GERAETE) as [Geraet, string][]).map(([g, text]) => (
          <label key={g} className="toggle">
            <input type="checkbox" checked={geraete.includes(g)} onChange={() => umschalten(g)} />
            {text}
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="stufe">Kleinste Gewichtsstufe (kg)</label>
        <input id="stufe" className="input" inputMode="decimal" autoComplete="off" aria-describedby="stufe-hinweis" value={stufe}
          onChange={(e) => { setMeldung(null); setStufe(e.target.value); }} />
        <p id="stufe-hinweis" className="muted">
          Um so viel schlägt die App höchstens eine Steigerung vor. Üblich sind 2,5 kg.
        </p>
      </div>
      <button type="button" className="btn" disabled={busy} onClick={speichern}>
        Speichern
      </button>
      {meldung?.art === "ok" && <p role="status">{meldung.text}</p>}
      {meldung && meldung.art !== "ok" && (
        <p role="alert" className="error">
          {meldung.text}{" "}
          {meldung.art === "einwilligung" && (
            <Link href="/einwilligung/A?next=/konto/geraete" className="link">
              Einwilligung ansehen
            </Link>
          )}
        </p>
      )}
      <Link href="/konto" className="link">
        Zurück
      </Link>
    </main>
  );
}
